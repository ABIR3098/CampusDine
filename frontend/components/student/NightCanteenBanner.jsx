// CampusDine: Modular Night Canteen Exam Craving Banner
(function () {
  function NightCanteenBanner({ onAddToCart, className = "" }) {
    const items = [
      { id: 991, name: "Midnight Spicy Egg Maggi", price: 50, icon: "🍜" },
      { id: 992, name: "Kadak Masala Chai", price: 15, icon: "☕" },
      { id: 993, name: "Cold Brew Espresso", price: 40, icon: "🧊" },
      { id: 994, name: "Cheesy Midnight Toast", price: 35, icon: "🥪" }
    ];

    return (
      <div className={`mb-4 px-4 py-3 rounded-2xl border transition-all bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white border-indigo-500/40 shadow-lg ${className}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">🌙</span>
            <div>
              <div className="font-display font-black text-sm flex items-center gap-2">
                <span>Night Canteen & Exam Craving Window</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500 text-white">
                  11 PM – 2 AM
                </span>
              </div>
              <div className="text-xs text-indigo-200 mt-0.5">
                Exam all-nighter? Order hot noodles, kadak chai & energy study snacks with fast 10-min counter pickup.
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-indigo-800/60 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-indigo-300">Quick Study Fuel:</span>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onAddToCart && onAddToCart(item)}
              className="px-3 py-1.5 rounded-xl bg-indigo-800 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <span>{item.icon}</span>
              <span>{item.name} (৳{item.price}) +</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.NightCanteenBanner = NightCanteenBanner;
})();
