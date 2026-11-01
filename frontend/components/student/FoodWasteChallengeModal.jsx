// CampusDine: Modular Campus Food Waste Challenge & Clean Plate Tracker
(function () {
  const { useState } = React;

  function FoodWasteChallengeModal({ user, onClose, onPledgeSuccess }) {
    const [streakDays, setStreakDays] = useState(12);
    const [pledged, setPledged] = useState(false);

    const handlePledge = () => {
      setPledged(true);
      if (window.CDComponents && window.CDComponents.AudioPlayer) {
        window.CDComponents.AudioPlayer.play("win");
      }
      if (onPledgeSuccess) {
        onPledgeSuccess("🌱 Clean Plate Pledge recorded! +25 Eco Points added.");
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in font-sans">
        <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-900 dark:text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800"
          >
            ✕
          </button>

          <div className="text-center space-y-2">
            <span className="text-4xl">🌍</span>
            <h3 className="font-display font-black text-xl text-emerald-600 dark:text-emerald-400">
              Campus Zero Food Waste Challenge
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Join 400+ campus residents pledging to eliminate dining plate waste.
            </p>
          </div>

          <div className="my-5 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block uppercase">
                Your Clean Plate Streak
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-mono font-black text-2xl text-emerald-700 dark:text-emerald-300">
                  {streakDays}
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Days</span>
              </div>
            </div>
            <span className="text-3xl">🔥</span>
          </div>

          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-emerald-500 font-bold">✓</span>
              <span>Take only what you can eat from the canteen counter</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500 font-bold">✓</span>
              <span>Earn <b>+30 Eco Points</b> on every 100% finished meal</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500 font-bold">✓</span>
              <span>Top monthly zero-waste champions receive free feast passes</span>
            </div>
          </div>

          <div className="mt-6">
            {pledged ? (
              <div className="p-3 bg-emerald-600 text-white font-bold text-center rounded-2xl text-xs shadow">
                ✓ Pledged for Today! See you at dinner.
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePledge}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all"
              >
                🌱 Pledge Clean Plate Today (+25 Pts)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.FoodWasteChallengeModal = FoodWasteChallengeModal;
})();
