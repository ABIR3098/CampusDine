// CampusDine UI: Modular Input Component
(function () {
  function CDInput({
    label,
    helperText,
    error,
    icon = null,
    iconRight = null,
    className = "",
    type = "text",
    value,
    onChange,
    id,
    placeholder,
    disabled = false,
    required = false,
    ...props
  }) {
    const inputId = id || "cd_input_" + Math.random().toString(36).substr(2, 9);

    return (
      <div className={`w-full flex flex-col gap-1.5 ${className}`}>
        {label && (
          <label htmlFor={inputId} className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <span>{label}</span>
            {required && <span className="text-rose-500">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-3 text-slate-400 pointer-events-none">
              {icon}
            </span>
          )}
          <input
            id={inputId}
            type={type}
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
            className={`w-full rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3.5 py-2.5 text-sm transition-all outline-none focus:ring-2 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800 ${
              icon ? "pl-9" : ""
            } ${iconRight ? "pr-9" : ""} ${
              error
                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
                : "border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-emerald-500/20"
            }`}
            {...props}
          />
          {iconRight && (
            <span className="absolute right-3 text-slate-400">
              {iconRight}
            </span>
          )}
        </div>
        {error && (
          <span className="text-xs text-rose-500 font-semibold">{error}</span>
        )}
        {!error && helperText && (
          <span className="text-[11px] text-slate-400">{helperText}</span>
        )}
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.Input = CDInput;
})();
