// CampusDine UI: Modular Toast Notification Component
(function () {
  function CDToast({
    message,
    type = "success", // success, error, info, warning
    onClose,
    className = ""
  }) {
    if (!message) return null;

    const styles = {
      success: "bg-emerald-800 text-white border-emerald-700",
      error: "bg-rose-800 text-white border-rose-700",
      warning: "bg-amber-800 text-white border-amber-700",
      info: "bg-sky-800 text-white border-sky-700"
    }[type] || "bg-slate-900 text-white border-slate-800";

    const icons = {
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ"
    }[type] || "ℹ";

    return (
      <div
        role="alert"
        className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold animate-slide-up ${styles} ${className}`}
      >
        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-xs">
          {icons}
        </span>
        <span className="flex-1">{message}</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-full transition-all text-xs opacity-75 hover:opacity-100"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.Toast = CDToast;
})();
