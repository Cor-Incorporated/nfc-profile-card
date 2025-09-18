import React from "react";
import { useNode } from "@craftjs/core";
import { cn } from "@/lib/utils";

interface ContainerProps {
  background?: string;
  padding?: number;
  children?: React.ReactNode;
  className?: string;
}

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ background = "transparent", padding = 20, children, className }, ref) => {
    const {
      connectors: { connect, drag },
    } = useNode();

    return (
      <div
        ref={(element) => {
          if (element) {
            connect(drag(element));
            if (typeof ref === "function") ref(element);
            else if (ref) ref.current = element;
          }
        }}
        className={cn(
          "min-h-[100px] flex flex-col items-center gap-4",
          className,
        )}
        style={{
          backgroundColor: background,
          padding: `${padding}px`,
          width: "100%",
        }}
      >
        {children}
      </div>
    );
  },
);

Container.displayName = "Container";

(Container as any).craft = {
  displayName: "Container",
  props: {
    background: "#ffffff",
    padding: 20,
  },
  rules: {
    canDrag: () => true,
  },
};
