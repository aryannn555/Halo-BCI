import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        "border-highlight": "var(--border-highlight)",
        text: "var(--text)",
        muted: "var(--muted)",
        left: {
          DEFAULT: "var(--left)",
          12: "var(--left-glow-12)",
          30: "var(--left-glow-30)",
        },
        right: {
          DEFAULT: "var(--right)",
          12: "var(--right-glow-12)",
          30: "var(--right-glow-30)",
        },
        success: "var(--success)",
        error: "var(--error)",
        halo: {
          bg: "var(--background)",
          surface: "var(--surface-1)",
          surface2: "var(--surface-2)",
          surface3: "#1B2026",
          border: "var(--border)",
          borderHover: "rgba(255, 255, 255, 0.15)",
          text: "var(--text)",
          muted: "var(--muted)",
          left: "var(--left)",
          right: "var(--right)",
          success: "var(--success)",
          error: "var(--error)",
        },
      },
      borderRadius: {
        "panel-sm": "16px",
        "panel": "22px",
        "panel-lg": "28px",
        "3xl": "24px",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "-apple-system", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.45)",
        "glass-raised": "0 16px 40px -10px rgba(0, 0, 0, 0.6)",
        "glass-hero": "0 20px 48px -12px rgba(0, 0, 0, 0.7)",
        glowLeft: "0 0 25px rgba(76, 201, 240, 0.22)",
        glowRight: "0 0 25px rgba(255, 181, 71, 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
