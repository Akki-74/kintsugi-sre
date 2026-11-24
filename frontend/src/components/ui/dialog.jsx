import * as React from "react";
import { cn } from "../../lib/utils";

const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-md animate-fade-in"
      onClick={() => onOpenChange?.(false)}
    >
      {children}
    </div>
  );
};

const DialogContent = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "kintsugi-panel border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn("flex items-center justify-between border-b border-slate-800 px-6 py-4", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("font-display text-lg font-bold text-white", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-slate-400", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn("flex items-center justify-between border-t border-slate-800/80 px-6 py-3.5 bg-slate-950/40 backdrop-blur-sm", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
