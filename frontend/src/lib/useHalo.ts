"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConfigMsg,
  ControlMsg,
  FrameMsg,
  HelloMsg,
  MotorImageryClass,
  ServerMsg,
  StatusMsg,
} from "./contract";
import { useHaloStore } from "./store";
import {
  togglePauseOfflineReplay,
  setOfflineReplaySpeed,
} from "./offlinePlayer";

export interface UseHaloOptions {
  url?: string;
  autoConnect?: boolean;
}

export interface UseHaloReturn {
  connected: boolean;
  connecting: boolean;
  hello: HelloMsg | null;
  status: StatusMsg | null;
  frame: FrameMsg | null;
  error: string | null;
  sendControl: (
    action: ControlMsg["action"],
    options?: { subject?: number; speed?: number; want?: MotorImageryClass }
  ) => void;
  sendConfig: (config: Partial<Omit<ConfigMsg, "type">>) => void;
  reconnect: () => void;
}

const DEFAULT_WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

// Shared socket reference and pending outbound queue for global dispatchers
let globalWs: WebSocket | null = null;
const pendingMessageQueue: string[] = [];

export function sendHaloControl(
  action: ControlMsg["action"],
  opts?: { subject?: number; speed?: number; want?: MotorImageryClass }
) {
  if (useHaloStore.getState().isOffline) {
    if (action === "pause" || action === "start") {
      togglePauseOfflineReplay();
    } else if (action === "change_speed" && opts?.speed) {
      setOfflineReplaySpeed(opts.speed);
    }
    return true;
  }

  const msg: ControlMsg = {
    type: "control",
    action,
    subject: opts?.subject,
    speed: opts?.speed,
    want: opts?.want,
  };
  const payload = JSON.stringify(msg);

  if (!globalWs || globalWs.readyState === WebSocket.CLOSED || globalWs.readyState === WebSocket.CLOSING) {
    console.warn("[Halo] Cannot send control message; socket is closed or uninitialized.");
    return false;
  }

  if (globalWs.readyState === WebSocket.CONNECTING) {
    pendingMessageQueue.push(payload);
    return true;
  }

  globalWs.send(payload);
  return true;
}

export function sendHaloConfig(config: Partial<Omit<ConfigMsg, "type">>) {
  const msg: ConfigMsg = {
    type: "config",
    ...config,
  };
  const payload = JSON.stringify(msg);

  if (!globalWs || globalWs.readyState === WebSocket.CLOSED || globalWs.readyState === WebSocket.CLOSING) {
    console.warn("[Halo] Cannot send config message; socket is closed or uninitialized.");
    return false;
  }

  if (globalWs.readyState === WebSocket.CONNECTING) {
    pendingMessageQueue.push(payload);
    useHaloStore.getState().setConfig(config);
    return true;
  }

  globalWs.send(payload);
  useHaloStore.getState().setConfig(config);
  return true;
}

export function useHalo(options: UseHaloOptions = {}): UseHaloReturn {
  const { url = DEFAULT_WS_URL, autoConnect = true } = options;

  const [connected, setConnected] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [hello, setHello] = useState<HelloMsg | null>(null);
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const [frame, setFrame] = useState<FrameMsg | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    clearReconnectTimer();
    setConnecting(true);
    setError(null);
    useHaloStore.getState().setConnectionStatus(false, true, null);

    // If WebSocket does not connect within 3 seconds, offer offline session replay
    const offlineOfferTimeout = setTimeout(() => {
      if (isMountedRef.current && !useHaloStore.getState().connected) {
        useHaloStore.getState().setOfflineOffered(true);
      }
    }, 3000);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      globalWs = ws;

      ws.onopen = () => {
        clearTimeout(offlineOfferTimeout);
        if (!isMountedRef.current) return;
        setConnected(true);
        setConnecting(false);
        setError(null);
        reconnectAttemptRef.current = 0;
        useHaloStore.getState().setConnectionStatus(true, false, null);
        useHaloStore.getState().setOffline(false);
        useHaloStore.getState().setOfflineOffered(false);

        // Flush any queued outbound messages immediately upon connection
        while (pendingMessageQueue.length > 0) {
          const queued = pendingMessageQueue.shift();
          if (queued && ws.readyState === WebSocket.OPEN) {
            ws.send(queued);
          }
        }
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        if (!isMountedRef.current) return;
        try {
          const msg: ServerMsg = JSON.parse(event.data);
          switch (msg.type) {
            case "hello":
              setHello(msg);
              useHaloStore.getState().setHello(msg);
              break;
            case "status":
              setStatus(msg);
              useHaloStore.getState().setStatus(msg);
              break;
            case "frame":
              setFrame(msg);
              useHaloStore.getState().addFrame(msg);
              break;
            case "error":
              setError(msg.message);
              useHaloStore.getState().setError(msg.message);
              break;
          }
        } catch (err) {
          console.error("[useHalo] Failed to parse WebSocket message:", err);
        }
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        const msg = "WebSocket connection error.";
        setError(msg);
        useHaloStore.getState().setConnectionStatus(false, false, msg);
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setConnected(false);
        setConnecting(false);
        wsRef.current = null;
        globalWs = null;
        useHaloStore.getState().setConnectionStatus(false, false);

        // Exponential backoff reconnect: 1s, 2s, capped at 6s
        const delay = Math.min(6000, 1000 * Math.pow(1.5, reconnectAttemptRef.current));
        reconnectAttemptRef.current += 1;
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connect();
          }
        }, delay);
      };
    } catch (err) {
      if (!isMountedRef.current) return;
      setConnecting(false);
      const msg = err instanceof Error ? err.message : "Failed to initialize WebSocket";
      setError(msg);
      useHaloStore.getState().setConnectionStatus(false, false, msg);
    }
  }, [url, clearReconnectTimer]);

  useEffect(() => {
    isMountedRef.current = true;
    if (autoConnect) {
      connect();
    }
    return () => {
      isMountedRef.current = false;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        globalWs = null;
      }
    };
  }, [autoConnect, connect, clearReconnectTimer]);

  const sendControl = useCallback(
    (action: ControlMsg["action"], opts?: { subject?: number; speed?: number }) => {
      sendHaloControl(action, opts);
    },
    []
  );

  const sendConfig = useCallback((config: Partial<Omit<ConfigMsg, "type">>) => {
    sendHaloConfig(config);
  }, []);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      globalWs = null;
    }
    reconnectAttemptRef.current = 0;
    connect();
  }, [connect]);

  return {
    connected,
    connecting,
    hello,
    status,
    frame,
    error,
    sendControl,
    sendConfig,
    reconnect,
  };
}
