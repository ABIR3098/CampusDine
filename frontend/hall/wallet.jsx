// Hall wallet tab: the same wallet as the restaurants (balance, add money, send money, history, referral).
// The real screen is WalletTab from campusdine.html; the data and actions come in through `ext`.
function HallWallet({ ui, ext, token }) {
  const W = ui && ui.WalletTab;
  if (!W || !ext || !ext.wallet) {
    return <HallCard title="My wallet" icon="👛"><div className="hl-empty">Wallet is not available right now.</div></HallCard>;
  }
  return (
    <W apiBase={ext.apiBase} token={token} balance={ext.wallet.balance} topUp={ext.topUp}
      transactions={ext.wallet.transactions} busy={ext.busy} onLookup={ext.onLookup} onSend={ext.onSend} />
  );
}
Hall.register({ key: "wallet", label: "Wallet", icon: "👛", order: 6.5, roles: ["student", "teacher"], component: HallWallet });
