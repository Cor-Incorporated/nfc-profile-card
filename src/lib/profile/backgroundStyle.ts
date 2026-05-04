import type { CSSProperties } from "react";

interface ProfileBackground {
  type?: string;
  color?: string;
  from?: string;
  to?: string;
  opacity?: number;
  url?: string;
}

export function getBackgroundStyle(
  background: ProfileBackground | null | undefined,
): CSSProperties {
  if (!background) return {};

  switch (background.type) {
    case "solid":
    case "color":
      return { backgroundColor: background.color };

    case "gradient":
      return {
        background: `linear-gradient(135deg, ${background.from || "#667eea"}, ${background.to || "#764ba2"})`,
      };

    case "image": {
      const opacity = background.opacity ?? 0.5;
      return {
        backgroundImage: `linear-gradient(rgba(255, 255, 255, ${1 - opacity}), rgba(255, 255, 255, ${1 - opacity})), url(${background.url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundBlendMode: "normal",
      };
    }

    default:
      return {};
  }
}
