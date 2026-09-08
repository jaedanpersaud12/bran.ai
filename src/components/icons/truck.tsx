"use client";

import type { Transition } from "motion/react";
import { motion, useAnimation, useReducedMotion } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface TruckIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface TruckIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  strokeWidth?: number;
}

const DEFAULT_TRANSITION: Transition = {
  type: "spring",
  stiffness: 100,
  damping: 14,
  mass: 1,
};

const TruckIcon = forwardRef<TruckIconHandle, TruckIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 16, strokeWidth = 1.5, ...props }, ref) => {
    const controls = useAnimation();
    const shouldReduceMotion = useReducedMotion();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: async () => {
          if (shouldReduceMotion) return;
          await controls.start("firstState");
          await controls.start("secondState");
        },
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      async (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else if (!shouldReduceMotion) {
          await controls.start("firstState");
          await controls.start("secondState");
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
            d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"
            transition={DEFAULT_TRANSITION}
            variants={{
              normal: { x: 0 },
              firstState: { x: 2 },
              secondState: { x: 0 },
            }}
          />
          <path d="M15 18H9" />
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
          <circle cx="17" cy="18" r="2" />
          <circle cx="7" cy="18" r="2" />
        </svg>
      </div>
    );
  }
);

TruckIcon.displayName = "TruckIcon";

export { TruckIcon };
