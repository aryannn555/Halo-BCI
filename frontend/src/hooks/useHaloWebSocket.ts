"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClientConfigMessage,
  ClientControlMessage,
  FrameMessage,
  HelloMessage,
  ServerMessage,
  StatusMessage,
} from "@/types/halo";

export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

interface UseHaloWebSocketReturn {
  connectionState: ConnectionState;
  hello: HelloMessage | null;
  replayStatus: StatusMessage | null;
  latestFrame: FrameMessage | null;
  frameBufferRef: React.MutableRefObject<FrameMessage[]>;
  errorMessage: string | null;
  sendControl: (action: "start" | "pause" | "reset", subject?: number, speed?: number) => void;
  sendConfig: (config: {
    model?: string;
    noise_snr_db?: number | null;
    threshold?: number;
    dwell_ms?: number;
  }) => void;
  togglePlayPause: () => void;
  resetStream: () => void;
  setSubject: (subject: number) => void;
  setModel: (model: string) => void;
  setNoiseSNR: (snr: number | null) => void;
  clearError: () => void;
}

export function useHaloWebSocket(
  url: string = "ws://localhost:8000/ws"
): UseHaloWebSocketReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [hello, setHello] = useState<HelloMessage | null>(null);
  const [replayStatus, setReplayStatus] = useState<StatusMessage | null>(null);
  const [latestFrame, setLatestFrame] = useState<FrameMessage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Circular frame buffer for high-fps canvas waveform rendering (avoids React re-renders)
  const frameBufferRef = useRef<FrameMessage[]>([]);
  const isMountedRef = useRef<boolean>(true);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    try {
      setConnectionState("connecting");
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setConnectionState("connected");
        setErrorMessage(null);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!isMountedRef.current) return;
        try {
          const data: ServerMessage = JSON.parse(event.data);
          if (data.type === "hello") {
            setHello(data);
          } else if (data.type === "status") {
            setReplayStatus(data);
          } else if (data.type === "frame") {
            setLatestFrame(data);
            // Append to fast canvas buffer (max 150 frames = ~6 seconds of 40ms hops)
            const buf = frameBufferRef.current;
            buf.push(data);
            if (buf.length > 150) {
              buf.shift();
            }
          } else if (data.type === "error") {
            setErrorMessage(data.message);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        setConnectionState("error");
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setConnectionState("disconnected");
        // Reconnect after 2 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
      };
    } catch (err) {
      console.error("WebSocket connection failure:", err);
      setConnectionState("error");
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 2000);
    }
  }, [url]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const sendControl = useCallback(
    (action: "start" | "pause" | "reset", subject?: number, speed?: number) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const msg: ClientControlMessage = {
          type: "control",
          action,
          subject,
          speed,
        };
        socketRef.current.send(JSON.stringify(msg));
      }
    },
    []
  );

  const sendConfig = useCallback(
    (config: {
      model?: string;
      noise_snr_db?: number | null;
      threshold?: number;
      dwell_ms?: number;
    }) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const msg: ClientConfigMessage = {
          type: "config",
          ...config,
        };
        socketRef.current.send(JSON.stringify(msg));
      }
    },
    []
  );

  const togglePlayPause = useCallback(() => {
    const currentState = replayStatus?.state ?? "idle";
    if (currentState === "running") {
      sendControl("pause");
    } else {
      sendControl("start");
    }
  }, [replayStatus, sendControl]);

  const resetStream = useCallback(() => {
    sendControl("reset");
    frameBufferRef.current = [];
  }, [sendControl]);

  const setSubject = useCallback(
    (subject: number) => {
      sendControl("reset", subject);
      frameBufferRef.current = [];
    },
    [sendControl]
  );

  const setModel = useCallback(
    (model: string) => {
      sendConfig({ model });
    },
    [sendConfig]
  );

  const setNoiseSNR = useCallback(
    (snr: number | null) => {
      sendConfig({ noise_snr_db: snr });
    },
    [sendConfig]
  );

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  return {
    connectionState,
    hello,
    replayStatus,
    latestFrame,
    frameBufferRef,
    errorMessage,
    sendControl,
    sendConfig,
    togglePlayPause,
    resetStream,
    setSubject,
    setModel,
    setNoiseSNR,
    clearError,
  };
}
