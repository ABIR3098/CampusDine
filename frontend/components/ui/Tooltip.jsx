// CampusDine UI: Modular Tooltip Component
(function () {
  const { useState } = React;

  function CDTooltip({
    content,
    position = "top", // top, bottom, left, right
    children,
    className = ""
  }) {
    const [visible, setVisible] = useState(false);

    const posClasses = {
      top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
      bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
      left: "right-full top-1/2 -translate-y-1/2 mr-2",
      right: "left-full top-1/2 -translate-y-1/2 ml-2"
    }[position] || "bottom-full left-1/2 -translate-x-1/2 mb-2";

    return (
      <div
        className={`relative inline-block ${className}`}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
        {visible && content && (
          <div
            role="tooltip"
            className={`absolute z-40 px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-900 dark:bg-slate-800 rounded-lg shadow-lg whitespace-nowrap pointer-events-none transition-all ${posClasses}`}
          >
            {content}
          </div>
        )}
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.Tooltip = CDTooltip;
})();
