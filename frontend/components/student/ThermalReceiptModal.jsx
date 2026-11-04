// CampusDine: Modular 80mm Thermal Receipt POS Slip Component
(function () {
  function ThermalReceiptModal({ order, onClose }) {
    if (!order) return null;

    const printSlip = () => {
      window.print();
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
        <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 text-slate-900 font-mono text-xs">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full bg-slate-100"
          >
            ✕
          </button>

          <div id="thermal-print-slip" className="p-3 border border-dashed border-slate-300 rounded-2xl bg-slate-50 space-y-3">
            {/* Store Header */}
            <div className="text-center space-y-1">
              <h2 className="font-display font-black text-base uppercase tracking-wider text-slate-950">
                CampusDine Express
              </h2>
              <p className="text-[10px] text-slate-500">BUP Central Cafeteria, Mirpur Cantt</p>
              <div className="border-b border-dashed border-slate-300 pt-2" />
            </div>

            {/* Token & Info */}
            <div className="flex justify-between items-center py-1">
              <span className="font-bold">TOKEN:</span>
              <span className="font-black text-lg text-emerald-800">{order.token}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>Date: {new Date(order.created_at || Date.now()).toLocaleDateString()}</span>
              <span>Time: {new Date(order.created_at || Date.now()).toLocaleTimeString()}</span>
            </div>
            <div className="border-b border-dashed border-slate-300" />

            {/* Items */}
            <div className="space-y-1.5 py-1">
              {(order.items || []).map((it, idx) => (
                <div key={idx} className="flex justify-between text-[11px]">
                  <span>{it.qty || 1}x {it.name}</span>
                  <span className="font-bold">৳{Number(it.price || 0) * (it.qty || 1)}</span>
                </div>
              ))}
            </div>
            <div className="border-b border-dashed border-slate-300" />

            {/* Total */}
            <div className="flex justify-between text-sm font-black pt-1">
              <span>TOTAL PAID:</span>
              <span className="text-emerald-800">৳{order.total || order.total_amount || 0}</span>
            </div>

            {/* Barcode Simulation */}
            <div className="pt-3 text-center space-y-1">
              <div className="inline-flex items-center gap-0.5 h-8 px-2 bg-white border border-slate-200">
                {Array.from({ length: 32 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-full ${i % 3 === 0 ? "w-1 bg-black" : i % 2 === 0 ? "w-0.5 bg-black" : "w-0.5 bg-transparent"}`}
                  />
                ))}
              </div>
              <div className="text-[9px] text-slate-400 tracking-widest uppercase">
                {order.token || "CD-ORDER"}
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={printSlip}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              <span>🖨️</span> Print Slip
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.ThermalReceiptModal = ThermalReceiptModal;
})();
