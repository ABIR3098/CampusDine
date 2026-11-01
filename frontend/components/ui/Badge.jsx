// CampusDine UI: Modular Badge Component
(function () {
  function CDBadge({
    children,
    variant = "neutral", // neutral, success, warning, danger, info, gold, eco
    size = "md", // sm, md
    dot = false,
    className = "",
    ...props
  }) {
    const sizeClasses = {
      sm: "px-2 py-0.5 text-[10px]",
      md: "px-2.5 py-1 text-xs"
    }[size] || "px-2.5 py-1 text-xs";

    const variantStyles = {
      neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
      success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60",
      warning: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60",
      danger: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60",
      info: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 border border-sky-200 dark:border-sky-800/60",
      gold: "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700",
      eco: "bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
    }[variant] || "bg-slate-100 text-slate-700";

    const dotColors = {
      neutral: "bg-slate-400",
      success: "bg-emerald-500",
      warning: "bg-amber-500",
      danger: "bg-rose-500",
      info: "bg-sky-500",
      gold: "bg-amber-500",
      eco: "bg-teal-500"
    }[variant] || "bg-slate-400";

    return (
      <span
        className={`inline-flex items-center gap-1.5 font-bold rounded-full tracking-wide uppercase font-mono ${sizeClasses} ${variantStyles} ${className}`}
        {...props}
      >
        {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors}`} />}
        <span>{children}</span>
      </span>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.Badge = CDBadge;
})();
