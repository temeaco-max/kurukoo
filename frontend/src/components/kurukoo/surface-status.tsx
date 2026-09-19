import { cn } from "@/lib/utils";

export type SurfaceStatus =
  "connected" | "available" | "needs-attention" | "not-configured" | "empty";

const labels: Record<SurfaceStatus, string> = {
  connected: "Connected",
  available: "Available",
  "needs-attention": "Needs attention",
  "not-configured": "Not configured",
  empty: "Nothing here yet",
};

export function SurfaceStatus({
  status,
  className,
}: {
  status: SurfaceStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[9.5px] font-medium",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "connected"
            ? "bg-primary"
            : status === "needs-attention"
              ? "bg-foreground"
              : "bg-muted-foreground/50",
        )}
      />
      {labels[status]}
    </span>
  );
}
