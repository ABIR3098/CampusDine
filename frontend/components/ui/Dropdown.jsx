// CampusDine UI: Modular Dropdown Component
(function () {
  const { useState, useEffect, useRef } = React;

  function CDDropdown({
    trigger,
    items = [], // { label, value, icon, danger, disabled, onClick }
    onSelect,
    align = "right", // left, right
    className = ""
  }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
      const handleClickOutside = (e) => {
        if (ref.current && !ref.current.contains(e.target)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
      <div className={`relative inline-block text-left ${className}`} ref={ref}>
        <div onClick={() => setOpen(!open)}>{trigger}</div>
        {open && (
          <div
            className={`absolute z-30 mt-2 w-48 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-100 dark:border-slate-800 p-1.5 focus:outline-none ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {items.map((item, idx) => (
              <button
                key={idx}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  if (item.onClick) item.onClick();
                  if (onSelect) onSelect(item.value || item);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                  item.danger
                    ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                } ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {item.icon && <span className="text-sm shrink-0">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.Dropdown = CDDropdown;
})();
