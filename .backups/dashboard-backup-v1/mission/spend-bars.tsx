import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/cletus/format";
import type { SpendPoint } from "@/lib/cletus/types";

export function SpendBars({
  data,
  className,
  heightClass = "h-28",
}: {
  data: SpendPoint[];
  className?: string;
  heightClass?: string;
}) {
  const max = Math.max(...data.map((d) => d.cents), 1);
  const spent = data.reduce((sum, p) => sum + p.cents, 0);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className={cn("flex items-end gap-px", heightClass)} role="img" aria-label={`Spend ${formatCents(spent)} over 24 hours`}>
        {data.map((point, i) => {
          const pct = Math.max(6, Math.round((point.cents / max) * 100));
          return (
            <div
              key={`${point.hour}-${i}`}
              className="flex-1 rounded-t-[2px] bg-primary/55 hover:bg-primary"
              style={{ height: `${pct}%` }}
              title={`${point.hour} · ${formatCents(point.cents)}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{data[0]?.hour}</span>
        <span>{formatCents(spent)} / 24h</span>
        <span>{data[data.length - 1]?.hour}</span>
      </div>
    </div>
  );
}
