// CampusDine: Modular Kitchen Display System (KDS) Component
(function () {
  const { useState, useEffect } = React;

  function KitchenDisplaySystem({ orders = [], advance, onExit, call, onShowPosSlip }) {
    const [filter, setFilter] = useState("active");
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [lastOrderCount, setLastOrderCount] = useState(orders.length);

    useEffect(() => {
      if (orders.length > lastOrderCount && soundEnabled) {
        if (window.CDComponents && window.CDComponents.AudioPlayer) {
          window.CDComponents.AudioPlayer.play("chime");
        }
      }
      setLastOrderCount(orders.length);
    }, [orders.length, soundEnabled]);

    const activeOrders = orders.filter((o) => o.status !== "Cancelled" && o.status !== "Ready");
    const filtered = activeOrders.filter((o) => {
      if (filter === "cooking") return o.status === "Cooking";
      if (filter === "received") return o.status === "Received";
      return true;
    });

    const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };

    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col font-sans overflow-hidden">
        {/* Top KDS Bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-pulse">🍳</span>
              <span className="font-display font-black text-xl tracking-wider text-amber-400">
                KITCHEN DISPLAY SYSTEM
              </span>
            </div>
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilter("active")}
                className={`px-3 py-1.5 rounded-lg transition-all ${filter === "active" ? "bg-amber-500 text-slate-950 font-black shadow" : "text-slate-400 hover:text-white"}`}
              >
                All Active ({activeOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("received")}
                className={`px-3 py-1.5 rounded-lg transition-all ${filter === "received" ? "bg-amber-500 text-slate-950 font-black shadow" : "text-slate-400 hover:text-white"}`}
              >
                Received ({activeOrders.filter((o) => o.status === "Received").length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("cooking")}
                className={`px-3 py-1.5 rounded-lg transition-all ${filter === "cooking" ? "bg-amber-500 text-slate-950 font-black shadow" : "text-slate-400 hover:text-white"}`}
              >
                Cooking ({activeOrders.filter((o) => o.status === "Cooking").length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                soundEnabled
                  ? "border-emerald-500/50 bg-emerald-950/60 text-emerald-400"
                  : "border-slate-700 bg-slate-800 text-slate-400"
              }`}
            >
              <span>{soundEnabled ? "🔔 Chime ON" : "🔕 Muted"}</span>
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold"
            >
              ⛶ Fullscreen
            </button>
            <button
              type="button"
              onClick={onExit}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
            >
              ✕ Exit KDS
            </button>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center h-64 text-slate-500">
              <span className="text-4xl mb-2">🍽️</span>
              <p className="text-base font-bold">No active orders in kitchen queue</p>
            </div>
          ) : (
            filtered.map((order) => (
              <div
                key={order.token}
                className={`rounded-2xl border flex flex-col justify-between overflow-hidden transition-all shadow-xl ${
                  order.status === "Cooking"
                    ? "bg-slate-900/90 border-amber-500/60"
                    : "bg-slate-900/60 border-slate-800"
                }`}
              >
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <span className="font-mono font-black text-xl text-amber-400">{order.token}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${
                      order.status === "Cooking" ? "bg-amber-500 text-slate-950" : "bg-sky-500 text-white"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="p-4 flex-1 space-y-2">
                  {(order.items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm font-semibold">
                      <span>{item.qty || 1}x {item.name}</span>
                    </div>
                  ))}
                  {order.note && (
                    <div className="p-2 bg-slate-800/80 rounded-xl text-xs text-amber-200 mt-2">
                      📝 {order.note}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                  {order.status === "Received" ? (
                    <button
                      type="button"
                      onClick={() => advance && advance(order.id)}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider"
                    >
                      🔥 Start Cooking
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => advance && advance(order.id)}
                      className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider"
                    >
                      ✓ Mark Ready for Pickup
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.KitchenDisplaySystem = KitchenDisplaySystem;
})();
