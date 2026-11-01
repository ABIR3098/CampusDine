// CampusDine: Modular Interactive Campus Live Rider GPS Delivery Map
(function () {
  const { useState, useEffect } = React;

  function LiveRiderMap({ order, onClose }) {
    const [progress, setProgress] = useState(35);
    const [rider, setRider] = useState({
      name: "Tariqul Islam",
      phone: "+880 1712-345678",
      vehicle: "Bicycle Fleet #04",
      rating: "4.9 ★"
    });

    // Simulate animated bike movement along campus route
    useEffect(() => {
      const timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return 20; // Loop simulation
          return prev + 1.5;
        });
      }, 800);
      return () => clearInterval(timer);
    }, []);

    const remainingMins = Math.max(1, Math.ceil(((100 - progress) / 100) * 12));
    const distanceMeters = Math.max(40, Math.round(((100 - progress) / 100) * 850));

    // Calculate rider SVG coordinate interpolation
    const startX = 60, startY = 220; // Central Cafeteria
    const endX = 340, endY = 60;    // Muktijoddha Hall
    const riderX = startX + (endX - startX) * (progress / 100);
    const riderY = startY + (endY - startY) * (progress / 100);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in font-sans">
        <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-white">
          {/* Header */}
          <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xl animate-pulse">🚴‍♂️</span>
              <div>
                <h3 className="font-display font-black text-sm text-amber-400">
                  Live Campus Delivery Tracking
                </h3>
                <p className="text-[11px] text-slate-400">Order #{order?.token || "T-8921"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800"
            >
              ✕
            </button>
          </div>

          {/* Interactive Campus Vector Map */}
          <div className="relative w-full h-72 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden border-b border-slate-800">
            {/* Grid overlay for map feel */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage: "radial-gradient(#64748b 1px, transparent 1px)",
                backgroundSize: "20px 20px"
              }}
            />

            <svg viewBox="0 0 400 280" className="w-full h-full">
              {/* Campus Roads */}
              <path
                d="M 60,220 Q 180,180 220,130 T 340,60"
                fill="none"
                stroke="#334155"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Animated delivery route line */}
              <path
                d="M 60,220 Q 180,180 220,130 T 340,60"
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeDasharray="6 4"
                strokeLinecap="round"
                className="animate-pulse"
              />

              {/* Landmark 1: Canteen */}
              <g transform="translate(60, 220)">
                <circle r="14" fill="#047857" className="animate-ping opacity-30" />
                <circle r="12" fill="#059669" />
                <text y="4" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">🏪</text>
                <text y="24" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="bold">Canteen</text>
              </g>

              {/* Landmark 2: Library */}
              <g transform="translate(190, 160)">
                <rect x="-10" y="-10" width="20" height="20" rx="4" fill="#1e293b" stroke="#475569" />
                <text y="4" textAnchor="middle" fill="#fff" fontSize="10">📚</text>
                <text y="22" textAnchor="middle" fill="#64748b" fontSize="8">Library</text>
              </g>

              {/* Landmark 3: Destination Hall */}
              <g transform="translate(340, 60)">
                <circle r="14" fill="#f59e0b" className="animate-ping opacity-30" />
                <circle r="12" fill="#d97706" />
                <text y="4" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">🏢</text>
                <text y="24" textAnchor="middle" fill="#fcd34d" fontSize="9" fontWeight="bold">Hall Gate</text>
              </g>

              {/* Animated Rider Pin */}
              <g transform={"translate(" + riderX + ", " + riderY + ")"}>
                <circle r="14" fill="#3b82f6" className="animate-ping opacity-40" />
                <circle r="10" fill="#2563eb" stroke="#fff" strokeWidth="2" />
                <text y="3.5" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">🚴</text>
              </g>
            </svg>

            {/* Live ETA Card floating on map */}
            <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-700/80 rounded-2xl px-3 py-2 backdrop-blur shadow-lg">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Estimated Arrival</span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono font-black text-xl text-emerald-400">{remainingMins}</span>
                <span className="text-xs text-slate-300 font-bold">mins</span>
                <span className="text-[11px] text-slate-500 font-medium">({distanceMeters}m away)</span>
              </div>
            </div>
          </div>

          {/* Rider Profile Card & Action Bar */}
          <div className="p-4 bg-slate-950 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-300">
                  TI
                </div>
                <div>
                  <h4 className="font-display font-bold text-sm text-white flex items-center gap-2">
                    <span>{rider.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-300">{rider.rating}</span>
                  </h4>
                  <p className="text-xs text-slate-400">{rider.vehicle}</p>
                </div>
              </div>
              <a
                href={"tel:" + rider.phone}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-all"
              >
                <span>📞</span> Call Rider
              </a>
            </div>

            {/* Status Step Bar */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="text-emerald-400 font-bold">✓ Picked Up</span>
              <span className="text-amber-400 font-bold animate-pulse">● On Route to Hall</span>
              <span className="text-slate-600">○ Delivered</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.LiveRiderMap = LiveRiderMap;
})();
