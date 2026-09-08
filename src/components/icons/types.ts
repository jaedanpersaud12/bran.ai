import type { ForwardRefExoticComponent, RefAttributes } from "react";

/**
 * The shape every icon in this folder shares.
 *
 * The components come from lucide-animated as source we own, one file each, so
 * their handles and props are structurally identical without being nominally
 * related. These two types are what lets a nav array hold them side by side.
 *
 * Passing a ref is also what hands control over: an icon left to itself
 * animates when the pointer is over the glyph, which in a nav row is a 16px
 * target inside a 200px one. Every call site here drives the animation from
 * the row instead.
 */
export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export type AnimatedIcon = ForwardRefExoticComponent<
  {
    size?: number;
    strokeWidth?: number;
    className?: string;
  } & RefAttributes<AnimatedIconHandle>
>;
