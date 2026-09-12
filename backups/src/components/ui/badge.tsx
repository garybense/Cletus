import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-foreground",
        ok: "border-ok/30 bg-ok/15 text-ok",
        warn: "border-warn/30 bg-warn/15 text-warn",
        crit: "border-destructive/35 bg-destructive/15 text-destructive",
        outline: "border-border text-muted-foreground",
        quiet: "border-transparent bg-accent text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
