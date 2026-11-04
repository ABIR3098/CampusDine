// CampusDine UI: Modular Card Component
(function () {
  function CDCard({
    children,
    title,
    subtitle,
    headerRight = null,
    footer = null,
    interactive = false,
    onClick,
    className = "",
    ...props
  }) {
    return (
      <div
        onClick={onClick}
        className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all duration-200 overflow-hidden ${
          interactive ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : ""
        } ${className}`}
        {...props}
      >
        {(title || subtitle || headerRight) && (
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              {title && (
                <h4 className="font-display font-bold text-slate-900 dark:text-white text-sm">
                  {title}
                </h4>
              )}
              {subtitle && (
                <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
              )}
            </div>
            {headerRight && <div>{headerRight}</div>}
          </div>
        )}
        <div className="p-4">{children}</div>
        {footer && (
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            {footer}
          </div>
        )}
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.Card = CDCard;
})();
