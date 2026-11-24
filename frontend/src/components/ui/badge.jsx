import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono-code text-[10px] font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400 select-none",
  {
    variants: {
      variant: {
        default:
          "border border-slate-700/60 bg-slate-800/50 backdrop-blur-sm text-slate-200",
        secondary:
          "border border-slate-800/60 bg-slate-900/50 backdrop-blur-sm text-slate-400",
        destructive:
          "border border-rose-500/40 bg-rose-950/45 backdrop-blur-sm text-rose-300",
        outline:
          "border border-slate-700/60 text-slate-300 backdrop-blur-sm",
        gold:
          "border border-amber-400/40 bg-amber-500/15 backdrop-blur-sm text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]",
        emerald:
          "border border-emerald-500/40 bg-emerald-950/45 backdrop-blur-sm text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]",
        cyan:
          "border border-cyan-500/40 bg-cyan-950/45 backdrop-blur-sm text-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.2)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
