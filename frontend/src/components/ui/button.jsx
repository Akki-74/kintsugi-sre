import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-slate-800/60 text-slate-100 hover:bg-slate-700/70 border border-slate-700/60 backdrop-blur-sm shadow-sm",
        destructive:
          "bg-rose-950/45 text-rose-300 border border-rose-500/50 hover:bg-rose-900/60 backdrop-blur-sm shadow-[0_0_12px_rgba(244,63,94,0.25)]",
        outline:
          "border border-slate-700/60 bg-transparent hover:bg-slate-800/50 text-slate-200 backdrop-blur-sm",
        secondary:
          "bg-slate-900/50 text-slate-200 border border-slate-800/70 hover:bg-slate-800/60 backdrop-blur-sm",
        ghost:
          "hover:bg-slate-800/50 hover:text-slate-100 text-slate-400 backdrop-blur-sm",
        link: "text-amber-400 underline-offset-4 hover:underline",
        gold:
          "bg-amber-500/20 text-amber-200 border border-amber-400/50 hover:bg-amber-500/30 hover:border-amber-300 backdrop-blur-sm shadow-[0_0_15px_rgba(245,158,11,0.2)]",
        emerald:
          "bg-emerald-950/45 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900/60 backdrop-blur-sm shadow-[0_0_12px_rgba(16,185,129,0.25)]",
        cyan:
          "bg-cyan-950/45 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-900/60 backdrop-blur-sm shadow-[0_0_12px_rgba(56,189,248,0.25)]",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 rounded-md px-2.5 text-[11px]",
        lg: "h-9 rounded-lg px-4 text-sm",
        icon: "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
