"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import type { AnimatedLottieIconHandle } from "@/components/ui/animated-lottie-icon";
import { PathLottieIcon } from "@/components/ui/path-lottie-icon";

interface HelpCenterLottieIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const HelpCenterLottieIcon = forwardRef<AnimatedLottieIconHandle, HelpCenterLottieIconProps>(
  ({ size = 20, ...props }, ref) => (
    <PathLottieIcon ref={ref} src="/animations/help-center.json" size={size} {...props} />
  ),
);

HelpCenterLottieIcon.displayName = "HelpCenterLottieIcon";

export { HelpCenterLottieIcon };
