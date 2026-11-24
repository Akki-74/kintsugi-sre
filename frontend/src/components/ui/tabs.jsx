import * as React from "react";
import { cn } from "../../lib/utils";

const TabsContext = React.createContext({
  value: "",
  onValueChange: () => {},
});

const Tabs = ({ value, defaultValue, onValueChange, className, children, ...props }) => {
  const [activeTab, setActiveTab] = React.useState(defaultValue || "");
  const currentTab = value !== undefined ? value : activeTab;
  const setTab = onValueChange || setActiveTab;

  return (
    <TabsContext.Provider value={{ value: currentTab, onValueChange: setTab }}>
      <div className={cn("flex flex-col gap-2", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-start rounded-lg bg-slate-900/45 backdrop-blur-sm p-1 text-slate-400 border border-slate-700/60",
      className
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef(({ className, value, ...props }, ref) => {
  const { value: selectedValue, onValueChange } = React.useContext(TabsContext);
  const isActive = selectedValue === value;
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-amber-500/20 text-amber-200 border border-amber-400/40 shadow-sm"
          : "hover:bg-slate-800/60 hover:text-slate-200 text-slate-400",
        className
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef(({ className, value, ...props }, ref) => {
  const { value: selectedValue } = React.useContext(TabsContext);
  if (selectedValue !== value) return null;
  return (
    <div
      ref={ref}
      className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}
      {...props}
    />
  );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
