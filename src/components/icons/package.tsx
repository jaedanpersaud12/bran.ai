"use client";

import type { Transition } from "motion/react";
import { motion, useAnimation, useReducedMotion } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface PackageIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface PackageIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  strokeWidth?: number;
}

const DEFAULT_TRANSITION: Transition = {
  type: "spring",
  stiffness: 100,
  damping: 14,
  mass: 1,
};

const PackageIcon = forwardRef<PackageIconHandle, PackageIconProps>(
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
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="M12 22V12" />
          <motion.path
            animate={controls}
            d="m3.3 7 8.7 5 8.7-5"
            transition={DEFAULT_TRANSITION}
            variants={{
              normal: { y: 0 },
              firstState: { y: -2 },
              secondState: { y: 0 },
            }}
          />
          <path d="m7.5 4.27 9 5.15" />
        </svg>
      </div>
    );
  }
);

PackageIcon.displayName = "PackageIcon";

export { PackageIcon };
