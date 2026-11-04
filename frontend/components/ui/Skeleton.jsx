// CampusDine UI: Modular Skeleton Loading Placeholder Component
(function () {
  function CDSkeleton({
    variant = "line", // line, circle, card, badge
    width = "w-full",
    height = "h-4",
    count = 1,
    className = ""
  }) {
    const items = Array.from({ length: count });

    if (variant === "circle") {
      return (
        <div className={`rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse ${width} ${height} ${className}`} />
      );
    }

    if (variant === "card") {
      return (
        <div className={`p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 ${className}`}>
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/3 animate-pulse" />
          <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded-md w-full animate-pulse" />
          <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded-md w-2/3 animate-pulse" />
          <div className="pt-2 flex justify-between items-center">
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-16 animate-pulse" />
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-20 animate-pulse" />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {items.map((_, idx) => (
          <div
            key={idx}
            className={`rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse ${width} ${height} ${className}`}
          />
        ))}
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.Skeleton = CDSkeleton;
})();
