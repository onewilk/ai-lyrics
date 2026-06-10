import { useEffect, useRef } from "react";
import Kawarp from "./kawarp/kawarp.js";

interface Props {
  /** 封面图源（spotify:image:… / data:… / https…）。 */
  imageSrc?: string;
}

/**
 * Kawarp 动态背景（移植自 lucid-lyrics）：流动扭曲的模糊封面。
 * React 版的 KawarpLayer：创建/销毁 Kawarp、随容器尺寸 resize、随封面切换 loadImage。
 */
export function KawarpBackground({ imageSrc }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const kawarpRef = useRef<InstanceType<typeof Kawarp> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // 参照 lucid 默认配置：brightness 0.8（更暗、文字更可读）、saturation 3.0（更鲜艳）、
    // blurPasses 12（更柔和）、深蓝低强度 tint。
    const kawarp = new Kawarp(canvas, {
      blurPasses: 12,
      brightness: 0.8,
      saturation: 3.0,
      dithering: 0.008,
      scale: 1.0,
      tintColor: [0.157, 0.157, 0.235],
      tintIntensity: 0.15,
      warpIntensity: 1.0,
      animationSpeed: 1.0,
      transitionDuration: 1000,
    });
    kawarpRef.current = kawarp;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container) {
          const { width, height } = entry.contentRect;
          canvas.width = Math.max(1, Math.floor(width));
          canvas.height = Math.max(1, Math.floor(height));
          kawarp.resize();
          kawarp.renderFrame();
        }
      }
    });
    ro.observe(container);
    kawarp.start();

    return () => {
      ro.disconnect();
      kawarp.dispose();
      kawarpRef.current = null;
    };
  }, []);

  useEffect(() => {
    const kawarp = kawarpRef.current;
    if (!kawarp || !imageSrc) return;
    const crossOrigin =
      imageSrc.startsWith("spotify:") || imageSrc.startsWith("data:") ? null : "anonymous";
    void kawarp.loadImage(imageSrc, crossOrigin);
  }, [imageSrc]);

  return (
    <div ref={containerRef} className="ail-bg" aria-hidden>
      <canvas ref={canvasRef} className="ail-bg-canvas" />
    </div>
  );
}
