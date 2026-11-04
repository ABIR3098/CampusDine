// CampusDine UI: Modular Button Component
(function () {
  const { createElement: h } = React;

  function CDButton({
    children,
    variant = "primary", // primary, secondary, outline, danger, ghost, success
    size = "md", // sm, md, lg
    loading = false,
    disabled = false,
    icon = null,
    iconRight = null,
    className = "",
    type = "button",
    onClick,
    ...props
  }) {
    const sizeClasses = {
      sm: "px-2.5 py-1 text-xs rounded-lg gap-1.5",
      md: "px-4 py-2 text-sm rounded-xl gap-2",
      lg: "px-6 py-3 text-base rounded-2xl gap-2.5"
    }[size] || "px-4 py-2 text-sm rounded-xl gap-2";

    const variantClasses = {
      primary: "btn-primary font-bold shadow-sm hover:shadow transition-all text-white",
      secondary: "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold border border-slate-200 dark:border-slate-700",
      outline: "border border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 font-semibold",
      danger: "bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm",
      ghost: "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium",
      success: "bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
    }[variant] || "btn-primary text-white";

    const isDisabled = disabled || loading;

    return (
      <button
        type={type}
        disabled={isDisabled}
        onClick={onClick}
        aria-busy={loading}
        className={`inline-flex items-center justify-center font-display transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {loading && (
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
        )}
        {!loading && icon && <span className="inline-flex shrink-0">{icon}</span>}
        <span>{children}</span>
        {!loading && iconRight && <span className="inline-flex shrink-0">{iconRight}</span>}
      </button>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.Button = CDButton;
})();
