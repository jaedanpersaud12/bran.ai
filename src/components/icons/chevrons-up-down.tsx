"use client";

import type { Transition } from "motion/react";
import { motion, useAnimation, useReducedMotion } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface ChevronsUpDownIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface ChevronsUpDownIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  strokeWidth?: number;
}

const DEFAULT_TRANSITION: Transition = {
  type: "spring",
  stiffness: 250,
  damping: 25,
};

const ChevronsUpDownIcon = forwardRef<
  ChevronsUpDownIconHandle,
  ChevronsUpDownIconProps
>(({ onMouseEnter, onMouseLeave, className, size = 16, strokeWidth = 1.5, ...props }, ref) => {
  const controls = useAnimation();
  const shouldReduceMotion = useReducedMotion();
  const isControlledRef = useRef(false);

  useImperativeHandle(ref, () => {
    isControlledRef.current = true;

    return {
      startAnimation: () => controls.start(shouldReduceMotion ? "normal" : "animate"),
      stopAnimation: () => controls.start("normal"),
    };
  });

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseEnter?.(e);
      } else {
        controls.start(shouldReduceMotion ? "normal" : "animate");
      }
    },
    [controls, onMouseEnter, shouldReduceMotion]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseLeave?.(e);
      } else {
        controls.start("normal");
      }
    },
    [controls, onMouseLeave]
  );

  return (
    <div
      className={cn(className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <svg
        aria-hidden
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.path
          animate={controls}
          d="m7 15 5 5 5-5"
          initial="normal"
          transition={DEFAULT_TRANSITION}
          variants={{
            normal: { translateY: "0%" },
            animate: { translateY: "2px" },
          }}
        />
        <motion.path
          animate={controls}
          d="m7 9 5-5 5 5"
          initial="normal"
          transition={DEFAULT_TRANSITION}
          variants={{
            normal: { translateY: "0%" },
            animate: { translateY: "-2px" },
          }}
        />
      </svg>
    </div>
  );
});

ChevronsUpDownIcon.displayName = "ChevronsUpDownIcon";

export { ChevronsUpDownIcon };
