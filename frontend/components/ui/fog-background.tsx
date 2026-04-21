"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FogBackgroundProps {
  className?: string;
  children?: ReactNode;
  color?: string;
  opacity?: number;
  speed?: number;
}

export function FogBackground({
  className,
  children,
  color = "#ffffff",
  opacity = 0.5,
  speed = 1,
}: FogBackgroundProps) {
  const duration1 = 60 / speed;
  const duration2 = 80 / speed;
  const duration3 = 100 / speed;

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden", className)}
      style={{
        background: "linear-gradient(to bottom, #0a0a12 0%, #000000 50%, #080810 100%)",
      }}
    >
      <div className="absolute inset-0" style={{ filter: "blur(80px)" }}>
        <div
          className="absolute h-[120%] w-[200%]"
          style={{
            animation: `fogDrift1 ${duration3}s ease-in-out infinite`,
            background: `radial-gradient(ellipse 50% 40% at 25% 50%, ${color}, transparent),
                         radial-gradient(ellipse 40% 50% at 75% 60%, ${color}, transparent)`,
            opacity: opacity * 0.3,
          }}
        />

        <div
          className="absolute h-[120%] w-[200%]"
          style={{
            animation: `fogDrift2 ${duration2}s ease-in-out infinite`,
            background: `radial-gradient(ellipse 60% 35% at 30% 40%, ${color}, transparent),
                         radial-gradient(ellipse 45% 45% at 70% 70%, ${color}, transparent)`,
            opacity: opacity * 0.4,
          }}
        />

        <div
          className="absolute h-[120%] w-[200%]"
          style={{
            animation: `fogDrift3 ${duration1}s ease-in-out infinite`,
            background: `radial-gradient(ellipse 55% 50% at 40% 55%, ${color}, transparent),
                         radial-gradient(ellipse 50% 35% at 60% 35%, ${color}, transparent)`,
            opacity: opacity * 0.35,
          }}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${color}, transparent)`,
          filter: "blur(120px)",
          opacity: opacity * 0.25,
        }}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(5,5,10,0.8) 100%)",
        }}
      />

      {children ? <div className="relative z-10 h-full w-full">{children}</div> : null}

      <style jsx>{`
        @keyframes fogDrift1 {
          0%,
          100% {
            transform: translateX(-10%) translateY(0%);
          }
          50% {
            transform: translateX(5%) translateY(-3%);
          }
        }
        @keyframes fogDrift2 {
          0%,
          100% {
            transform: translateX(0%) translateY(-2%);
          }
          50% {
            transform: translateX(-15%) translateY(2%);
          }
        }
        @keyframes fogDrift3 {
          0%,
          100% {
            transform: translateX(-5%) translateY(2%);
          }
          50% {
            transform: translateX(10%) translateY(-2%);
          }
        }
      `}</style>
    </div>
  );
}

export default function FogBackgroundDemo() {
  return <FogBackground />;
}
