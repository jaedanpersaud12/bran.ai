import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  /** A way forward: clear filters, create the first item. */
  action?: ReactNode;
  className?: string;
};

/** Icon, one line, a way forward. For empty tables, lists and search results. */
function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div data-slot="empty-state" className={cn("flex flex-col items-center gap-3 px-6 py-16 text-center", className)}>
      <span aria-hidden className="grid size-10 place-items-center rounded-full bg-muted text-subtle-foreground [&_svg]:size-5">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mx-auto max-w-md text-xs text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export { EmptyState };
