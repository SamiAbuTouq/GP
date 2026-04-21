"use client";

import { cn } from "@/lib/utils";
import type { HTMLMotionProps, Variants } from "motion/react";
import { motion, useAnimation, useReducedMotion } from "motion/react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

export interface CalendarIconHandle {
 startAnimation: () => void;
 stopAnimation: () => void;
}

interface CalendarIconProps extends HTMLMotionProps<"div"> {
 size?: number;
 duration?: number;
 isAnimated?: boolean;
}

const CalendarIcon = forwardRef<CalendarIconHandle, CalendarIconProps>(
 (
  {
   onMouseEnter,
   onMouseLeave,
   className,
   size = 20,
   duration = 1,
   isAnimated = true,
   ...props
  },
  ref,
 ) => {
  const controls = useAnimation();
  const reduced = useReducedMotion();
  const isControlled = useRef(false);

  useImperativeHandle(ref, () => {
   isControlled.current = true;
   return {
    startAnimation: () => (reduced ? controls.start("normal") : controls.start("animate")),
    stopAnimation: () => controls.start("normal"),
   };
  });

  const handleEnter = useCallback(
   (e?: React.MouseEvent<HTMLDivElement>) => {
    if (!isAnimated || reduced) return;
    if (!isControlled.current) controls.start("animate");
    else onMouseEnter?.(e as any);
   },
   [controls, reduced, isAnimated, onMouseEnter],
  );

  const handleLeave = useCallback(
   (e?: React.MouseEvent<HTMLDivElement>) => {
    if (!isControlled.current) controls.start("normal");
    else onMouseLeave?.(e as any);
   },
   [controls, onMouseLeave],
  );

  const bodyVariants: Variants = {
   normal: { y: 0, scaleY: 1 },
   animate: {
    y: [0, -0.5, 0],
    scaleY: [1, 1.03, 1],
    transition: {
     duration: 0.65 * duration,
     ease: "easeInOut" as const,
    },
   },
  };

  const headerVariants: Variants = {
   normal: { scaleX: 1 },
   animate: {
    scaleX: [1, 1.04, 1],
    transition: {
     duration: 0.55 * duration,
     ease: "easeInOut" as const,
    },
   },
  };

  const gridLineVariants: Variants = {
   normal: { pathLength: 1, opacity: 1 },
   animate: (delay: number) => ({
    pathLength: [0, 1],
    opacity: [0.3, 1],
    transition: {
      duration: 0.45 * duration,
      delay,
      ease: "easeOut" as const,
    },
   }),
  };

  const dotVariants: Variants = {
   normal: { y: 0, opacity: 1 },
   animate: (i: number) => ({
    y: [0, -1.5, 0],
    opacity: [1, 0.75, 1],
    transition: {
     duration: 0.35 * duration,
     delay: 0.08 * i,
     ease: "easeInOut" as const,
    },
   }),
  };

  return (
   <motion.div
    className={cn("inline-flex items-center justify-center", className)}
    onMouseEnter={handleEnter}
    onMouseLeave={handleLeave}
    {...props}
   >
    <motion.svg
     xmlns="http://www.w3.org/2000/svg"
     width={size}
     height={size}
     viewBox="0 0 24 24"
     fill="none"
     stroke="currentColor"
     strokeWidth="2"
     strokeLinecap="round"
     strokeLinejoin="round"
    >
     <motion.g variants={bodyVariants} initial="normal" animate={controls}>
      <motion.rect
       x="3"
       y="4"
       width="18"
       height="17"
       rx="2.5"
      />
      <motion.path
       d="M8 2v4"
      />
      <motion.path
       d="M16 2v4"
      />
      <motion.path
       d="M3 9h18"
       variants={headerVariants}
      />

      <motion.path
       d="M8 13h.01"
       variants={dotVariants}
       custom={0}
       initial="normal"
       animate={controls}
      />
      <motion.path
       d="M12 13h.01"
       variants={dotVariants}
       custom={1}
       initial="normal"
       animate={controls}
      />
      <motion.path
       d="M16 13h.01"
       variants={dotVariants}
       custom={2}
       initial="normal"
       animate={controls}
      />
      <motion.path
       d="M8 17h.01"
       variants={dotVariants}
       custom={3}
       initial="normal"
       animate={controls}
      />
      <motion.path
       d="M12 17h.01"
       variants={dotVariants}
       custom={4}
       initial="normal"
       animate={controls}
      />
      <motion.path
       d="M16 17h.01"
       variants={dotVariants}
       custom={5}
       initial="normal"
       animate={controls}
      />
     </motion.g>

     <motion.path
      d="M7 9.5v10"
      variants={gridLineVariants}
      custom={0.1}
      initial="normal"
      animate={controls}
      opacity={0.7}
    />
     <motion.path
      d="M12 9.5v10"
      variants={gridLineVariants}
      custom={0.16}
      initial="normal"
      animate={controls}
      opacity={0.7}
     />
     <motion.path
      d="M17 9.5v10"
      variants={gridLineVariants}
      custom={0.22}
      initial="normal"
      animate={controls}
      opacity={0.7}
     />
    </motion.svg>
   </motion.div>
  );
 },
);

CalendarIcon.displayName = "CalendarIcon";
export { CalendarIcon };

