import React from "react";

interface PreviewFrameProps {
  content: string;
  viewMode: "mobile" | "tablet" | "desktop";
  username: string;
}

export function PreviewFrame({
  content,
  viewMode,
  username,
}: PreviewFrameProps) {
  const getViewportWidth = () => {
    switch (viewMode) {
      case "mobile":
        return "375px";
      case "tablet":
        return "768px";
      case "desktop":
        return "100%";
    }
  };

  const getViewportHeight = () => {
    switch (viewMode) {
      case "mobile":
        return "667px";
      case "tablet":
        return "1024px";
      case "desktop":
        return "100%";
    }
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 overflow-auto">
      <div
        className="mx-auto bg-white rounded-lg shadow-lg transition-all"
        style={{
          width: getViewportWidth(),
          maxWidth: "100%",
          height: getViewportHeight(),
          maxHeight: "100vh",
        }}
      >
        <iframe
          src={`/p/${username}?preview=true`}
          className="w-full h-full border-0 rounded-lg"
          title="Preview"
        />
      </div>
    </div>
  );
}
