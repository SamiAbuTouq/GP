"use client";

import { cn } from "@/lib/utils";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

export interface AnimatedLottieIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface AnimatedLottieIconProps extends HTMLAttributes<HTMLDivElement> {
  animationData: object;
  size?: number;
}

const AnimatedLottieIcon = forwardRef<AnimatedLottieIconHandle, AnimatedLottieIconProps>(
  ({ animationData, onMouseEnter, onMouseLeave, className, size = 20, ...props }, ref) => {
    const lottieRef = useRef<LottieRefCurrentProps>(null);
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => {
          lottieRef.current?.goToAndStop(0, true);
          lottieRef.current?.play();
        },
        stopAnimation: () => {
          lottieRef.current?.stop();
          lottieRef.current?.goToAndStop(0, true);
        },
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          lottieRef.current?.goToAndStop(0, true);
          lottieRef.current?.play();
        }
      },
      [onMouseEnter],
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          lottieRef.current?.stop();
          lottieRef.current?.goToAndStop(0, true);
        }
      },
      [onMouseLeave],
    );

    return (
      <div
        className={cn("inline-flex items-center justify-center", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <Lottie
          lottieRef={lottieRef}
          animationData={animationData}
          autoplay={false}
          loop={false}
          style={{ width: size, height: size }}
        />
      </div>
    );
  },
);

AnimatedLottieIcon.displayName = "AnimatedLottieIcon";

export { AnimatedLottieIcon };
