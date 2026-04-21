"use client";

import type { HTMLAttributes } from "react";
import { forwardRef, useEffect, useState } from "react";

import { AnimatedLottieIcon, type AnimatedLottieIconHandle } from "@/components/ui/animated-lottie-icon";

interface PathLottieIconProps extends HTMLAttributes<HTMLDivElement> {
  src: string;
  size?: number;
}

const PathLottieIcon = forwardRef<AnimatedLottieIconHandle, PathLottieIconProps>(
  ({ src, size = 20, ...props }, ref) => {
    const [animationData, setAnimationData] = useState<object | null>(null);

    useEffect(() => {
      let isMounted = true;

      fetch(src)
        .then((response) => response.json())
        .then((data) => {
          if (isMounted) {
            setAnimationData(data);
          }
        })
        .catch(() => {
          if (isMounted) {
            setAnimationData(null);
          }
        });

      return () => {
        isMounted = false;
      };
    }, [src]);

    if (!animationData) {
      return <div className={props.className} style={{ width: size, height: size }} />;
    }

    return <AnimatedLottieIcon ref={ref} animationData={animationData} size={size} {...props} />;
  },
);

PathLottieIcon.displayName = "PathLottieIcon";

export { PathLottieIcon };
