// Hall chat: a hall resident talks only to the Hall Admin here. The canteen admin never reads these messages;
// when the canteen admin opens the Hall, this same tab lets them talk to the Hall Admin too (role "member").
// The Hall Admin replies from the Hall Admin portal (hall-admin.html → "Student messages").
function HallChat({ ui, ext, user, token }) {
  const Chat = ui && ui.ChatWorkspace;
  if (!Chat) return <HallCard title="Hall Admin chat" icon="💬"><div className="hl-empty">Chat is not available right now.</div></HallCard>;
  return (
    <Chat role={user.role === "admin" ? "member" : user.role} userId={user.id} apiBase={ext && ext.apiBase} sessionToken={token}
      refreshKey={(ext && ext.chatRefreshKey) || 0} scope="hall" />
  );
}
Hall.register({ key: "chat", label: "Hall Admin chat", icon: "💬", order: 8.5, roles: ["student", "teacher"], component: HallChat });
