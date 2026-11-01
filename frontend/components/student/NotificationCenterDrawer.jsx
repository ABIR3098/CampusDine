// CampusDine: Modular In-App Notification Center Drawer
(function () {
  const { useState } = React;

  function NotificationCenterDrawer({ isOpen = false, onClose, onNotificationClick }) {
    const [filter, setFilter] = useState("all");
    const [notifications, setNotifications] = useState([
      {
        id: "n1",
        title: "Order T-8921 Ready!",
        message: "Your Chicken Biryani is hot & ready for pickup at Counter 2.",
        time: "5 mins ago",
        category: "order",
        icon: "🍳",
        read: false
      },
      {
        id: "n2",
        title: "Grand Feast Pre-Booking Open",
        message: "Pre-book your Friday Special Grand Feast ticket before seats run out.",
        time: "1 hour ago",
        category: "hall",
        icon: "🏢",
        read: false
      },
      {
        id: "n3",
        title: "Daily Lucky Spin Ready",
        message: "You have 1 free lucky spin available today! Win up to ৳10 cashback.",
        time: "3 hours ago",
        category: "promo",
        icon: "🎰",
        read: true
      },
      {
        id: "n4",
        title: "Maintenance Ticket Resolved",
        message: "Caretaker has completed repair for Fan & Light in Room 304.",
        time: "Yesterday",
        category: "hall",
        icon: "🔧",
        read: true
      }
    ]);

    if (!isOpen) return null;

    const filtered = notifications.filter((n) => (filter === "all" ? true : n.category === filter));
    const unreadCount = notifications.filter((n) => !n.read).length;

    const markAllRead = () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    };

    const handleItemClick = (item) => {
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      if (onNotificationClick) onNotificationClick(item);
    };

    return (
      <div className="fixed inset-0 z-50 overflow-hidden font-sans">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="fixed inset-y-0 right-0 max-w-full flex">
          <div className="w-screen max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col text-slate-900 dark:text-white">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔔</span>
                <h3 className="font-display font-black text-base">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-100 dark:bg-slate-800"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex gap-1 bg-slate-50 dark:bg-slate-800/40 text-xs">
              {[
                ["all", "All"],
                ["order", "Orders"],
                ["hall", "Hall"],
                ["promo", "Promos"]
              ].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all ${
                    filter === k
                      ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No notifications in this category.</div>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3 rounded-2xl cursor-pointer transition-all flex items-start gap-3 my-1 ${
                      !item.read
                        ? "bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <span className="text-2xl p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-display font-bold text-xs text-slate-900 dark:text-white truncate">
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 shrink-0">{item.time}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.NotificationCenterDrawer = NotificationCenterDrawer;
})();
