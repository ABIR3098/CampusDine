// "Wallet" and "My profile" tabs. They reuse the very same screens the restaurants use (top-up, send money,
// transaction history, profile + password), which campusdine.html hands over through `ui` and `ext`.

function HallWallet({ ui, ext }) {
  const W = ui && ui.WalletTab;
  if (!W || !ext) return <HallCard title="Wallet" icon="👛"><div className="hl-empty">The wallet is not available right now.</div></HallCard>;
  return <W balance={ext.wallet.balance} topUp={ext.topUp} transactions={ext.wallet.transactions} busy={ext.busy} onLookup={ext.onLookup} onSend={ext.onSend} />;
}
Hall.register({ key: "wallet", label: "Wallet", icon: "👛", order: 8, roles: ["student", "teacher"], component: HallWallet });

function HallProfile({ ui, ext, user, call }) {
  const P = ui && ui.ProfileTab;
  if (!P || !ext) return <HallCard title="My profile" icon="👤"><div className="hl-empty">The profile is not available right now.</div></HallCard>;
  return <P user={user} call={call} onUpdated={ext.onProfileUpdated} />;
}
Hall.register({ key: "profile", label: "Profile", icon: "👤", order: 30, component: HallProfile });
