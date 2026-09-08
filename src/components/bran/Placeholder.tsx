import { ConstructionIcon } from "@/components/icons/construction";

/**
 * What a section looks like before it exists.
 *
 * Every item in the sidebar is a real route from day one. A nav that links to
 * nothing teaches people not to trust it, and a 404 is a worse answer than
 * "not yet" — this at least names the section they asked for.
 */
export function Placeholder({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="mx-auto flex min-h-[60svh] w-full max-w-md flex-col items-center justify-center text-center">
      {/* The badge is the icon's own wrapper, not a span around it: the hover
          that runs the barrier's stripes should be the whole 40px disc rather
          than the 16px of glyph inside it. */}
      <ConstructionIcon
        size={16}
        className="grid size-10 place-items-center rounded-full border border-border text-muted-foreground"
      />
      <h1 className="mt-4 text-[20px] font-semibold tracking-[-0.01em]">{title}</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground text-balance">{blurb}</p>
    </div>
  );
}
