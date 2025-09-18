import { createTheme, createThemeContract } from "@vanilla-extract/css";

// テーマコントラクト定義
export const themeVars = createThemeContract({
  colors: {
    primary: null,
    secondary: null,
    background: null,
    foreground: null,
    accent: null,
    muted: null,
  },
  fonts: {
    heading: null,
    body: null,
  },
  spacing: {
    xs: null,
    sm: null,
    md: null,
    lg: null,
    xl: null,
  },
  radius: {
    none: null,
    sm: null,
    md: null,
    lg: null,
    full: null,
  },
});

// デフォルトテーマ
export const defaultTheme = createTheme(themeVars, {
  colors: {
    primary: "#3B82F6",
    secondary: "#6B7280",
    background: "#FFFFFF",
    foreground: "#111827",
    accent: "#2563EB",
    muted: "#F3F4F6",
  },
  fonts: {
    heading: "Noto Sans JP, sans-serif",
    body: "Noto Sans JP, sans-serif",
  },
  spacing: {
    xs: "0.5rem",
    sm: "1rem",
    md: "1.5rem",
    lg: "2rem",
    xl: "3rem",
  },
  radius: {
    none: "0",
    sm: "0.25rem",
    md: "0.5rem",
    lg: "1rem",
    full: "9999px",
  },
});

// ダークテーマ
export const darkTheme = createTheme(themeVars, {
  colors: {
    primary: "#60A5FA",
    secondary: "#9CA3AF",
    background: "#111827",
    foreground: "#F3F4F6",
    accent: "#3B82F6",
    muted: "#1F2937",
  },
  fonts: {
    heading: "Noto Sans JP, sans-serif",
    body: "Noto Sans JP, sans-serif",
  },
  spacing: {
    xs: "0.5rem",
    sm: "1rem",
    md: "1.5rem",
    lg: "2rem",
    xl: "3rem",
  },
  radius: {
    none: "0",
    sm: "0.25rem",
    md: "0.5rem",
    lg: "1rem",
    full: "9999px",
  },
});
