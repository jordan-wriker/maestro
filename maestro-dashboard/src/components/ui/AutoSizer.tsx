import { useLayoutEffect, useRef, useState } from "react";

interface AutoSizerProps {
  children: (size: { height: number; width: number }) => React.ReactNode;
}

export default function AutoSizer({ children }: AutoSizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ height: 0, width: 0 });

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => {
      const nextHeight = element.clientHeight;
      const nextWidth = element.clientWidth;
      setSize((prev) =>
        prev.height === nextHeight && prev.width === nextWidth
          ? prev
          : { height: nextHeight, width: nextWidth }
      );
    };

    update();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(update);
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
      {children(size)}
    </div>
  );
}
