// CampusDine: Modular Leaderboard and Sustainability Badges Component
(function () {
  const { useState } = React;

  function LeaderboardAndBadges({ user, orders = [], onGoMenu, className = "" }) {
    const [activeTab, setActiveTab] = useState("leaderboard");

    const leaderboardUsers = [
      { rank: 1, name: "Tanvir Ahmed", badge: "Green Eco Hero", points: 1420, orders: 48, avatar: "🥇" },
      { rank: 2, name: "Afsana Mimi", badge: "Zero Waste Star", points: 1280, orders: 42, avatar: "🥈" },
      { rank: 3, name: "Sakib Al Hasan", badge: "BYOB Champion", points: 1150, orders: 39, avatar: "🥉" },
      { rank: 4, name: "Rahim Uddin", badge: "Eco Resident", points: 940, orders: 31, avatar: "🎖️" },
      { rank: 5, name: (user && user.name) || "You", badge: "Green Supporter", points: 720, orders: 24, avatar: "⭐", isCurrent: true }
    ];

    const badges = [
      { id: "eco_hero", icon: "🌱", title: "Green Eco Hero", desc: "Brought own tiffin carrier or water bottle 10 times", progress: 8, target: 10, unlocked: false },
      { id: "zero_waste", icon: "🍽️", title: "Zero Waste Champion", desc: "100% clean plate food logs for 15 consecutive days", progress: 15, target: 15, unlocked: true },
      { id: "hall_star", icon: "🏢", title: "Hall Dine Master", desc: "Attended all 3 main meals in hall dining for a full week", progress: 7, target: 7, unlocked: true },
      { id: "early_bird", icon: "☕", title: "Early Bird Diner", desc: "Ordered breakfast before 8:30 AM 5 times", progress: 3, target: 5, unlocked: false }
    ];

    return (
      <div className={`space-y-5 ${className}`}>
        {/* Sub-navigation tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("leaderboard")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "leaderboard"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>🏆</span> Campus Top Diners
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("badges")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "badges"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>🎖️</span> Sustainability Badges
          </button>
        </div>

        {/* Leaderboard View */}
        {activeTab === "leaderboard" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h3 className="font-display font-black text-lg text-slate-900 dark:text-white">
                Monthly Campus Dine Leaderboard
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Top diners with highest sustainability eco-points receive exclusive 10% canteen discount coupons every month!
              </p>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {leaderboardUsers.map((u) => (
                <div
                  key={u.rank}
                  className={`flex items-center justify-between py-3 px-3 rounded-2xl transition-all ${
                    u.isCurrent
                      ? "bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 font-bold"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{u.avatar}</span>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{u.name}</span>
                        {u.isCurrent && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-emerald-600 text-white rounded-md uppercase">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        {u.badge} · {u.orders} orders
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400">
                      {u.points} pts
                    </span>
                    <span className="text-[10px] text-slate-400 block">Rank #{u.rank}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Badges View */}
        {activeTab === "badges" && (
          <div className="grid sm:grid-cols-2 gap-4">
            {badges.map((b) => (
              <div
                key={b.id}
                className={`p-4 rounded-2xl border transition-all ${
                  b.unlocked
                    ? "bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-800 shadow-sm"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl p-2 rounded-2xl bg-slate-100 dark:bg-slate-800">{b.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                        {b.title}
                      </h4>
                      {b.unlocked ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Unlocked ✓
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          {b.progress}/{b.target}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{b.desc}</p>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: Math.min(100, (b.progress / b.target) * 100) + "%" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.LeaderboardAndBadges = LeaderboardAndBadges;
})();
