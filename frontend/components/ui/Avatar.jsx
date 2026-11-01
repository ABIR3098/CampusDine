// CampusDine UI: Modular Avatar Component
(function () {
  function CDAvatar({
    src,
    name = "User",
    size = "md", // sm, md, lg, xl
    online = undefined,
    className = ""
  }) {
    const sizeClasses = {
      sm: "w-7 h-7 text-xs",
      md: "w-9 h-9 text-sm",
      lg: "w-12 h-12 text-base",
      xl: "w-16 h-16 text-xl"
    }[size] || "w-9 h-9 text-sm";

    const initials = (name || "U")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return (
      <div className={`relative inline-block ${className}`}>
        {src ? (
          <img
            src={src}
            alt={name}
            className={`rounded-full object-cover border border-slate-200 dark:border-slate-700 ${sizeClasses}`}
          />
        ) : (
          <div
            className={`rounded-full flex items-center justify-center font-display font-bold text-emerald-800 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 ${sizeClasses}`}
          >
            {initials}
          </div>
        )}
        {online !== undefined && (
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
              online ? "bg-emerald-500" : "bg-slate-400"
            }`}
          />
        )}
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.Avatar = CDAvatar;
})();
