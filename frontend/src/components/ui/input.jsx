import * as React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-lg border border-slate-700/60 bg-slate-950/40 backdrop-blur-sm px-3 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
