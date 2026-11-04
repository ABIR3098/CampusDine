// CampusDine: Modular Daily Spin Wheel Modal
(function () {
  const { useState } = React;

  function DailySpinWheelModal({ user, onClose, onReward }) {
    const [spinning, setSpinning] = useState(false);
    const [result, setResult] = useState(null);
    const [rotation, setRotation] = useState(0);

    const segments = [
      { label: "৳2 Cashback", val: 2, type: "cash", color: "#10b981", textColor: "#fff" },
      { label: "5% Off", val: 5, type: "coupon", color: "#f59e0b", textColor: "#fff" },
      { label: "৳5 Cashback", val: 5, type: "cash", color: "#3b82f6", textColor: "#fff" },
      { label: "Better Luck", val: 0, type: "none", color: "#64748b", textColor: "#fff" },
      { label: "৳10 Jackpot", val: 10, type: "cash", color: "#8b5cf6", textColor: "#fff" },
      { label: "Free Tea", val: 15, type: "cash", color: "#ec4899", textColor: "#fff" },
      { label: "৳3 Cashback", val: 3, type: "cash", color: "#14b8a6", textColor: "#fff" },
      { label: "Extra +10 Pts", val: 10, type: "points", color: "#f97316", textColor: "#fff" }
    ];

    const spin = () => {
      if (spinning) return;
      setSpinning(true);
      setResult(null);

      if (window.CDComponents && window.CDComponents.AudioPlayer) {
        window.CDComponents.AudioPlayer.play("click");
      }

      const winIdx = Math.floor(Math.random() * segments.length);
      const degreesPerSeg = 360 / segments.length;
      const targetDeg = 360 * 5 + (360 - winIdx * degreesPerSeg - degreesPerSeg / 2);

      setRotation(targetDeg);

      setTimeout(() => {
        setSpinning(false);
        const win = segments[winIdx];
        setResult(win);
        if (window.CDComponents && window.CDComponents.AudioPlayer) {
          window.CDComponents.AudioPlayer.play("win");
        }
        if (win.type === "cash" && onReward) {
          onReward("🎉 Won ৳" + win.val + " cashback added to wallet!");
        } else if (win.type === "coupon" && onReward) {
          onReward("🎉 Won 5% discount coupon for your next order!");
        }
      }, 4000);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
        <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center text-white shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800"
          >
            ✕
          </button>

          <div className="mb-4">
            <span className="text-3xl">🎰</span>
            <h3 className="text-xl font-black font-display text-amber-400 mt-1">
              Daily Lucky Food Spin
            </h3>
            <p className="text-xs text-slate-400">
              Spin once every day to win instant wallet cashback & vouchers!
            </p>
          </div>

          {/* Wheel Container */}
          <div className="relative w-64 h-64 mx-auto my-6">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 text-rose-500 text-2xl font-black drop-shadow">
              ▼
            </div>
            <div
              className="w-full h-full rounded-full border-4 border-amber-400 shadow-xl overflow-hidden transition-transform duration-[4000ms] cubic-bezier(0.15, 0.9, 0.25, 1)"
              style={{
                transform: "rotate(" + rotation + "deg)",
                background: "conic-gradient(" +
                  segments.map((s, i) => s.color + " " + i * 45 + "deg " + (i + 1) * 45 + "deg").join(", ") +
                  ")"
              }}
            />
          </div>

          {/* Result or Action */}
          {result ? (
            <div className="p-3 bg-slate-800/80 rounded-2xl border border-amber-400/40 animate-bounce">
              <span className="text-xs text-amber-300 font-bold uppercase tracking-wider block">Reward Claimed!</span>
              <span className="text-lg font-black text-white">{result.label}</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={spinning}
              onClick={spin}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg disabled:opacity-50 transition-all"
            >
              {spinning ? "Spinning..." : "✨ Spin Now"}
            </button>
          )}
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.DailySpinWheelModal = DailySpinWheelModal;
})();
