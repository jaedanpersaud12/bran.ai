/**
 * A revenue total, split two ways, drawn as a ring of spokes.
 *
 * Every spoke is the same length, and the only thing the ring encodes is the
 * split: where the dark arc stops is the share.
 *
 * The spokes are not sixty-four elements. They are the dash pattern on two
 * arcs — a track arc carrying the whole sweep, and a darker one drawn over the
 * share. That is a drawing trick with a performance reason behind it: as
 * sixty-four `<line>` nodes each running its own entrance, the ring repainted
 * itself every frame for a second while the page was still hydrating, because
 * a transform on an SVG child is not composited the way it is on a div. Two
 * paths and one animation on the group cost effectively nothing, and the
 * spokes come out perfectly even by construction rather than by arithmetic.
 */

const SIZE = 320;
const CENTER = SIZE / 2;
/** Inner and outer edge of a spoke. The arc rides the middle of that band. */
const INNER = 110;
const LENGTH = 28;
const RADIUS = INNER + LENGTH / 2;
const SPOKES = 64;
/** How wide one spoke is along the arc. */
const SPOKE_WIDTH = 3;
/** The ring is open at the bottom, where the label sits. Degrees from 12. */
const SWEEP = 290;
const START = -SWEEP / 2;

/** Arc length of the full sweep, and the repeat that puts 64 spokes on it. */
const ARC_LENGTH = 2 * Math.PI * RADIUS * (SWEEP / 360);
const PERIOD = ARC_LENGTH / SPOKES;
const DASHES = `${SPOKE_WIDTH} ${round(PERIOD - SPOKE_WIDTH)}`;

export function RevenueDial({
  /** Fraction of the ring drawn in the reading colour, 0 to 1. */
  share,
  label,
  children,
}: {
  share: number;
  /** What the ring means, for anyone who cannot see it. */
  label: string;
  /** The total and its caption, centred in the ring. */
  children: React.ReactNode;
}) {
  // Snapped to whole spokes, so the dark arc never ends on half a mark.
  const filled = Math.round(clamp(share, 0, 1) * SPOKES);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block w-full" role="img" aria-label={label}>
        {/* One group, one animation — see the note at the top of the file. */}
        <g className="dial" strokeWidth={LENGTH} fill="none">
          <path d={arc(SWEEP)} stroke="var(--track)" strokeDasharray={DASHES} />
          {filled > 0 && (
            // Same start point and the same dash repeat, so its spokes land on
            // the track's rather than beside them.
            <path
              d={arc((filled / SPOKES) * SWEEP)}
              stroke="var(--step-3)"
              strokeDasharray={DASHES}
            />
          )}
        </g>
      </svg>

      {/* Centred content is HTML, not SVG text: it is real type, so it wraps,
          selects and scales with the rest of the page. */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">{children}</div>
      </div>
    </div>
  );
}

/**
 * An arc of `sweep` degrees, starting at the bottom-left opening and running
 * clockwise. Rounded to two decimals: `Math.sin` is not bit-identical across
 * engines, and an unrounded coordinate is a hydration mismatch on every
 * render. Two decimals is finer than a 320-unit viewBox can draw anyway.
 */
function arc(sweep: number): string {
  const [x0, y0] = point(START);
  const [x1, y1] = point(START + sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M${x0} ${y0}A${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x1} ${y1}`;
}

/** 0° is twelve o'clock and degrees run clockwise. */
function point(degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [
    round(CENTER + Math.sin(radians) * RADIUS),
    round(CENTER - Math.cos(radians) * RADIUS),
  ];
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
