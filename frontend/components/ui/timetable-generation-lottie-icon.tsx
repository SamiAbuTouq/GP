"use client";

import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import type { AnimatedLottieIconHandle } from "@/components/ui/animated-lottie-icon";
import { PathLottieIcon } from "@/components/ui/path-lottie-icon";

interface TimetableGenerationLottieIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const TimetableGenerationLottieIcon = forwardRef<
  AnimatedLottieIconHandle,
  TimetableGenerationLottieIconProps
>(({ size = 20, ...props }, ref) => (
  <PathLottieIcon
    ref={ref}
    src="/animations/timetable-generation.json"
    size={size}
    {...props}
  />
));

TimetableGenerationLottieIcon.displayName = "TimetableGenerationLottieIcon";

export { TimetableGenerationLottieIcon };
