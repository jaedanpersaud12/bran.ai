"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Fixed-length pages, built to app-ui §5 until `@ja3dan/table-pager` is
 * published: every page is `size` rows tall, a short page is padded with
 * empty rows, and the pager footer renders even when there's one page — so
 * the card is the same height whatever the data does.
 */

export function usePaged<T>(rows: T[], size = 10) {
  const [requested, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  // A filter that shrinks the list can leave the page past the end; clamp
  // rather than show an empty page.
  const page = Math.min(requested, pages);
  const start = (page - 1) * size;
  const slice = rows.slice(start, start + size);
  return {
    rows: slice,
    pad: size - slice.length,
    page,
    pages,
    from: rows.length === 0 ? 0 : start + 1,
    to: start + slice.length,
    total: rows.length,
    setPage,
  };
}

/** Empty rows that hold a short page at full height. Hidden from assistive tech. */
export function PadRows({ count, columns }: { count: number; columns: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <tr key={index} aria-hidden className="h-[var(--row-h,68px)]">
          <td colSpan={columns} />
        </tr>
      ))}
    </>
  );
}

export function TablePager({
  paged,
  noun,
}: {
  paged: Pick<ReturnType<typeof usePaged>, "page" | "pages" | "from" | "to" | "total" | "setPage">;
  /** Plural, for "1–10 of 42 variants". */
  noun: string;
}) {
  return (
    <footer className="flex h-[52px] items-center justify-between gap-3 border-t border-border px-4">
      <p className="font-mono text-[12px] text-muted-foreground tabular-nums">
        {paged.total === 0 ? `0 ${noun}` : `${paged.from}–${paged.to} of ${paged.total} ${noun}`}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous page"
          disabled={paged.page <= 1}
          onClick={() => paged.setPage(paged.page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-12 text-center font-mono text-[12px] tabular-nums">
          {paged.page} / {paged.pages}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next page"
          disabled={paged.page >= paged.pages}
          onClick={() => paged.setPage(paged.page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </footer>
  );
}
