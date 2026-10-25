// Hall profile tab. Payment and wallet features are intentionally excluded from Hall.
function HallProfile({ ui, ext, user, call }) {
  const P = ui && ui.ProfileTab;
  if (!P) return <HallCard title="My profile" icon="👤"><div className="hl-empty">Profile is not available right now.</div></HallCard>;
  return <P user={user} call={call} onUpdated={ext && ext.onProfileUpdated} />;
}
Hall.register({ key: "profile", label: "Profile", icon: "👤", order: 30, component: HallProfile });
