import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The table-card look, in one place.
 *
 * Every list screen renders the same card: a titled header with its own controls,
 * a tinted column band, then fixed-height rows separated by hairlines. The parts are
 * composable rather than config-driven because cells differ wildly — a rate is
 * editable, a status is a pill, a row ends in a button — and a column-definition
 * array would only push that back into render props.
 */

function TableCard({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="table-card"
      className={cn("flex min-w-0 flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-border", className)}
      {...props}
    />
  );
}

/**
 * Header strip: icon tile, title, an optional line saying what the table is, then
 * whatever controls the screen needs.
 *
 * `title` is dropped from the element's own props before they're intersected:
 * `<header>` has a DOM `title` (the tooltip), and the two meeting would narrow this
 * one back to a string and reject the heading nodes callers pass.
 */
function TableCardHeader({
  icon,
  title,
  note,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"header">, "title"> & {
  icon?: React.ReactNode;
  title: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <>
      <header
        data-slot="table-card-header"
        className={cn(
          // Tinted, so the card names itself on its own ground rather than on the rows'.
          // `background` and not `muted`: muted sits a hair under the card in light and
          // above it in dark, so only this one reads as a step down in both.
          "flex flex-wrap gap-x-3 gap-y-2.5 border-b border-border bg-background px-4 py-3.5",
          // With a note the heading is two lines and the icon belongs beside its first
          // line; without one, centring keeps the two on one centre.
          note ? "items-start" : "items-center",
          className,
        )}
        {...props}
      >
        {icon ? (
          <span
            aria-hidden
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground [&_svg]:size-3.5",
              note && "mt-0.5",
            )}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="font-heading text-lg leading-tight font-semibold">{title}</h2>
          {note ? <p className="mt-0.5 h-4 truncate text-[11px] leading-4 tracking-normal text-muted-foreground">{note}</p> : null}
        </div>
      </header>
      {/*
       * A strip of its own under the header, not a tail on the title's row: a toolbar this
       * size only just fits beside a title, and when it doesn't it wraps to a line it doesn't
       * fill, stranding a search field on the right with dead air beside it. Its own strip is
       * the same layout every time, and a field inside can grow across it — see
       * `applications-table.tsx`. `flex-wrap` is for the strip that is still too narrow for
       * the whole toolbar: the parts stack instead of clipping.
       */}
      {children ? (
        <div data-slot="table-card-toolbar" className="flex flex-wrap items-center gap-2 px-4 py-3">
          {children}
        </div>
      ) : null}
    </>
  );
}

/**
 * Row heights, declared by the table rather than discovered from the content.
 *
 * A row that sizes itself has a height that is a fact about today's data: one long
 * name wraps and that row alone grows. Pinning the height per table makes the
 * geometry a property of the screen, which a loading skeleton can predict, and costs
 * nothing: variable-length cells truncate.
 */
const ROW_HEIGHTS = {
  /** One line of text per cell. */
  compact: "[--row-h:48px]",
  /** Two stacked lines — a name over a phone number. */
  comfortable: "[--row-h:68px]",
  /** Two lines plus furniture: status pills, inline buttons, thumbnails. */
  rich: "[--row-h:80px]",
} as const;

type Density = keyof typeof ROW_HEIGHTS;

/**
 * Size each width to its column's longest realistic value, never bigger: dates, money, statuses and
 * actions must fit without truncating, and the one `""` column should be the genuinely long, variable
 * text (a description, an address) — not the name column by default, which otherwise stretches across
 * the card while short columns beside it cut off.
 *
 * Pass `columns` for widths that never move — use it for anything paginated, sorted
 * or filtered, where auto layout makes columns jump between pages. One width class
 * per column (`["w-56", "", "w-36"]`); leave one `""` to take the remaining space.
 */
function DataTable({
  minWidth,
  density = "comfortable",
  columns,
  className,
  containerClassName,
  children,
  ...props
}: React.ComponentProps<"table"> & {
  minWidth?: number;
  /** Row height for every body row. See `ROW_HEIGHTS`. */
  density?: Density;
  columns?: readonly string[];
  containerClassName?: string;
}) {
  return (
    // `relative` so absolutely positioned descendants (every `sr-only` label in a cell) are contained by
    // the scroll box. Without it they escape to the page, which then scrolls sideways to the table's
    // minWidth on a phone even though the table itself scrolls inside the card.
    <div data-slot="data-table-container" className={cn("scroll-slim relative overflow-x-auto", containerClassName)}>
      <table
        data-slot="data-table"
        style={minWidth ? { minWidth } : undefined}
        className={cn("w-full text-sm", ROW_HEIGHTS[density], columns && "table-fixed [&_td]:truncate", className)}
        {...props}
      >
        {columns ? (
          <colgroup>
            {columns.map((width, index) => (
              <col key={index} className={width || undefined} />
            ))}
          </colgroup>
        ) : null}
        {children}
      </table>
    </div>
  );
}

/** Column band. Sentence case at reading size — easier to scan than uppercase micro-caps. */
function Thead({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn("border-b border-border bg-muted/40 text-left text-[13px] font-medium tracking-normal text-muted-foreground", className)}
      {...props}
    />
  );
}

type Align = "left" | "right" | "center";

function Th({ align = "left", className, ...props }: React.ComponentProps<"th"> & { align?: Align }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-2.5 font-medium whitespace-nowrap",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

function Tbody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-border/70", className)} {...props} />;
}

/** A body row. Header rows are plain `<tr>`, so the fixed height lands only on data. */
function Tr({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("h-[var(--row-h,68px)] transition-colors hover:bg-muted/40", className)} {...props} />;
}

function Td({ align = "left", className, ...props }: React.ComponentProps<"td"> & { align?: Align }) {
  return (
    <td
      className={cn(
        "px-4 py-3.5",
        // Stacked cells are two lines by design; truncating is the rule, so a third
        // line can never appear and take the row's height with it.
        "[&>p]:truncate",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

/** A two-line cell — a name over a phone number, a summary over a count. */
function StackedCell({
  primary,
  secondary,
  className,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="truncate text-sm font-medium">{primary}</p>
      {secondary ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{secondary}</p> : null}
    </div>
  );
}

function Tfoot({ className, ...props }: React.ComponentProps<"tfoot">) {
  return <tfoot className={cn("border-t border-border bg-muted/25", className)} {...props} />;
}

/** Numerals that line up column-wise: refs, money, dates. */
const mono = "font-mono tabular-nums";

export {
  TableCard,
  TableCardHeader,
  DataTable,
  Thead,
  Th,
  Tbody,
  Tr,
  Td,
  StackedCell,
  Tfoot,
  ROW_HEIGHTS,
  mono,
  type Density,
};
