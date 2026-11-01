// CampusDine: direct chat between a teacher and a rider.
// A teacher opens it from the "Rider chat" tab, a rider from the "Teacher chat" tab of the Rider hub.
(function () {
  const { useState, useEffect, useRef } = React;
  const MAX_LENGTH = 2000;

  async function call(apiBase, token, path, options = {}) {
    const res = await fetch(apiBase + "/api/teacher-rider-chat" + path, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
    return data;
  }

  // Texts come from the app's translation function when it has the key, otherwise the English default is used.
  function makeT(tx) {
    return (key, fallback, vars) => {
      let out = typeof tx === "function" ? tx(key, vars) : key;
      if (out === key) {
        out = fallback;
        if (vars) Object.keys(vars).forEach((k) => { out = out.split("{" + k + "}").join(vars[k]); });
      }
      return out;
    };
  }

  const initialOf = (name) => (String(name || "?").trim().charAt(0) || "?").toUpperCase();
  // The server sends a new message as camelCase (REST answer and live event); the chat list uses the database column names.
  const fromPayload = (p) => ({
    id: p.id, sender_id: p.senderId, recipient_id: p.recipientId, message: p.message, created_at: p.createdAt,
    read_at: null, deleted_at: null, sender_name: p.senderName, sender_role: p.senderRole,
  });
  const timeOf = (iso) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  function TeacherRiderChat({ role, userId, apiBase, token, tx, refreshKey = 0 }) {
    const t = makeT(tx);
    const isTeacher = role === "teacher";
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [peer, setPeer] = useState(null); // the person whose chat is open: { id, name, role, external_id }
    const [messages, setMessages] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [firstUnreadId, setFirstUnreadId] = useState(null);
    const scrollRef = useRef(null);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [contacts, setContacts] = useState([]); // people I share an order with
    const [search, setSearch] = useState("");
    const [found, setFound] = useState([]);
    const peerRef = useRef(null);
    const reloadRef = useRef({});
    // @@state

    const loadThreads = async () => {
      try {
        const data = await call(apiBase, token, "/threads");
        setThreads(data.threads || []);
        setError("");
      } catch (e) {
        setError(e.message || "Could not load your chats.");
      } finally {
        setLoading(false);
      }
    };
    useEffect(() => { loadThreads(); }, [apiBase, token, refreshKey]);

    // Opening a chat marks the messages sent to me as read on the server, so the list is reloaded afterwards.
    const loadMessages = async (peerId, quiet) => {
      if (!quiet) setChatLoading(true);
      try {
        const data = await call(apiBase, token, "/" + peerId + "/messages");
        setMessages(data.messages || []);
        setFirstUnreadId(data.firstUnreadId || null);
        setError("");
        loadThreads();
      } catch (e) {
        setError(e.message || "Could not load the chat.");
      } finally {
        setChatLoading(false);
      }
    };

    const addMessage = (m) => setMessages((cur) => (
      cur.some((x) => Number(x.id) === Number(m.id)) ? cur : [...cur, m].sort((a, b) => Number(a.id) - Number(b.id))
    ));
    const send = async () => {
      const text = draft.trim();
      if (!text || sending || !peer) return;
      setSending(true);
      try {
        const data = await call(apiBase, token, "/" + peer.id + "/messages", { method: "POST", body: { message: text } });
        addMessage(fromPayload(data.message));
        setDraft("");
        setError("");
        loadThreads();
      } catch (e) {
        setError(e.message || "Could not send the message.");
      } finally {
        setSending(false);
      }
    };
    // Enter sends, Shift+Enter adds a new line.
    const onKeyDown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    };

    const searching = search.trim().length >= 2;
    const people = searching ? found : contacts;
    const startChat = (person) => {
      setPeer({ id: person.id, name: person.name, role: person.role, external_id: person.external_id });
      setSearch("");
    };

    // The live listeners are created once, so they read the open chat and the loaders through refs.
    peerRef.current = peer;
    reloadRef.current = { loadThreads, loadMessages };
    const removeMessage = async (id) => {
      if (!window.confirm(t("trc.confirmDelete", "Delete this message for both of you?"))) return;
      try {
        await call(apiBase, token, "/messages/" + id, { method: "DELETE" });
        setMessages((cur) => cur.map((m) => (Number(m.id) === Number(id) ? { ...m, message: "", deleted_at: new Date().toISOString() } : m)));
        loadThreads();
      } catch (e) {
        setError(e.message || "Could not delete the message.");
      }
    };
    // @@actions

    const openThread = (thread) => {
      setPeer({ id: thread.peer_id, name: thread.name, role: thread.role, external_id: thread.external_id });
    };
    useEffect(() => {
      setMessages([]);
      setFirstUnreadId(null);
      if (peer) loadMessages(peer.id);
    }, [peer && peer.id]);
    useEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, peer && peer.id]);
    useEffect(() => {
      let live = true;
      call(apiBase, token, "/contacts").then((d) => { if (live) setContacts(d.users || []); }).catch(() => {});
      return () => { live = false; };
    }, [apiBase, token]);
    // Search by name or ID while typing (2+ letters), with a short pause so the server is not asked on every key.
    useEffect(() => {
      const q = search.trim();
      if (q.length < 2) { setFound([]); return undefined; }
      let live = true;
      const timer = setTimeout(() => {
        call(apiBase, token, "/directory?q=" + encodeURIComponent(q)).then((d) => { if (live) setFound(d.users || []); }).catch(() => {});
      }, 300);
      return () => { live = false; clearTimeout(timer); };
    }, [search, apiBase, token]);
    // Live: a new message, "seen" marks and deletions arrive without a refresh.
    useEffect(() => {
      if (typeof io !== "function") return undefined;
      const socket = io(apiBase, { auth: { token } });
      socket.on("teacher-rider-chat:message", (p) => {
        const mineSent = Number(p.senderId) === Number(userId);
        const other = mineSent ? Number(p.recipientId) : Number(p.senderId);
        const open = peerRef.current && Number(peerRef.current.id) === other;
        if (open && !mineSent) reloadRef.current.loadMessages(other, true); // reading it also marks it as read
        else {
          if (open) setMessages((cur) => (cur.some((x) => Number(x.id) === Number(p.id)) ? cur : [...cur, fromPayload(p)]));
          reloadRef.current.loadThreads();
        }
      });
      socket.on("teacher-rider-chat:read", (p) => {
        if (!peerRef.current || Number(peerRef.current.id) !== Number(p.readerId)) return;
        setMessages((cur) => cur.map((m) => (Number(m.sender_id) === Number(userId) && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m)));
      });
      socket.on("teacher-rider-chat:deleted", (p) => {
        setMessages((cur) => cur.map((m) => (Number(m.id) === Number(p.id) ? { ...m, message: "", deleted_at: new Date().toISOString() } : m)));
        reloadRef.current.loadThreads();
      });
      return () => { socket.disconnect(); };
    }, [apiBase, token, userId]);
    // @@effects

    return (
      <div className="card p-0 overflow-hidden">
        <div className="grid md:grid-cols-[300px_1fr]">
          <aside className={(peer ? "hidden md:flex" : "flex") + " flex-col md:border-r"} style={{ borderColor: "var(--line)" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--line)" }}>
              <div className="font-display font-800">💬 {isTeacher ? t("trc.title.teacher", "Chat with riders") : t("trc.title.rider", "Chat with teachers")}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>
                {isTeacher ? t("trc.sub.teacher", "Message the rider who brings your order.") : t("trc.sub.rider", "Message the teachers you deliver to.")}
              </div>
            </div>
            <div className="px-3 py-2 border-b" style={{ borderColor: "var(--line)" }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} maxLength={60}
                placeholder={isTeacher ? t("trc.find.teacher", "Find a rider by name or ID") : t("trc.find.rider", "Find a teacher you deliver to")}
                className="w-full rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--line)", background: "var(--input-bg)", color: "var(--ink)" }} />
              {people.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <div className="w-full text-[11px] font-700 uppercase tracking-wider" style={{ color: "var(--ink-soft)" }}>
                    {searching ? t("trc.results", "Results") : isTeacher ? t("trc.contacts.teacher", "Your riders") : t("trc.contacts.rider", "Your teachers")}
                  </div>
                  {people.map((u) => (
                    <button key={u.id} type="button" onClick={() => startChat(u)} className="px-2.5 py-1 rounded-full text-xs font-700 border" style={{ borderColor: "var(--line)" }}>
                      {u.name}
                    </button>
                  ))}
                </div>
              )}
              {searching && found.length === 0 && (
                <div className="mt-2 text-xs" style={{ color: "var(--ink-soft)" }}>
                  {isTeacher ? t("trc.noResults.teacher", "No rider found.") : t("trc.noResults.rider", "No teacher found. You can write to teachers whose order you deliver.")}
                </div>
              )}
            </div>
            {/* @@people */}
            <div className="flex-1 overflow-y-auto" style={{ maxHeight: 460 }}>
              {loading && <div className="p-4 text-xs font-600" style={{ color: "var(--ink-soft)" }}>{t("trc.loading", "Loading…")}</div>}
              {!loading && threads.length === 0 && (
                <div className="p-4 text-sm" style={{ color: "var(--ink-soft)" }}>{t("trc.noThreads", "No chats yet.")}</div>
              )}
              {threads.map((th) => (
                <button key={th.thread_id} type="button" onClick={() => openThread(th)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 border-b"
                  style={{ borderColor: "var(--line)", background: peer && Number(peer.id) === Number(th.peer_id) ? "var(--panel-soft)" : "transparent" }}>
                  <span className="w-9 h-9 rounded-full grid place-items-center font-800 shrink-0" style={{ background: "var(--gold)", color: "#fff" }}>{initialOf(th.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-700 truncate">{th.name}</span>
                    <span className="block text-xs truncate" style={{ color: "var(--ink-soft)" }}>{th.last_message}</span>
                  </span>
                  {th.unread_count > 0 && <span className="chat-badge">{th.unread_count}</span>}
                </button>
              ))}
            </div>
          </aside>
          <section className={(peer ? "flex" : "hidden md:flex") + " flex-col min-h-[320px]"}>
            {error && <div className="m-3 p-2 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger-fg)" }}>{error}</div>}
            {peer ? (
              <>
                <header className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: "var(--line)" }}>
                  <button type="button" className="md:hidden px-2 py-1 rounded-lg border text-sm" style={{ borderColor: "var(--line)" }} onClick={() => setPeer(null)}>←</button>
                  <span className="w-9 h-9 rounded-full grid place-items-center font-800 shrink-0" style={{ background: "var(--gold)", color: "#fff" }}>{initialOf(peer.name)}</span>
                  <div className="min-w-0">
                    <div className="font-700 text-sm truncate">{peer.name}</div>
                    <div className="text-xs" style={{ color: "var(--ink-soft)" }}>
                      {peer.role === "rider" ? t("trc.role.rider", "Rider") : t("trc.role.teacher", "Teacher")}{peer.external_id ? " · " + peer.external_id : ""}
                    </div>
                  </div>
                </header>
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3" style={{ maxHeight: 400, minHeight: 240 }}>
                  {chatLoading && <div className="text-center text-xs font-600" style={{ color: "var(--ink-soft)" }}>{t("trc.loading", "Loading…")}</div>}
                  {!chatLoading && messages.length === 0 && (
                    <div className="text-center text-sm py-8" style={{ color: "var(--ink-soft)" }}>{t("trc.empty", "No messages yet. Say hello 👋")}</div>
                  )}
                  {messages.map((m) => {
                    const mine = Number(m.sender_id) === Number(userId);
                    return (
                      <div key={m.id}>
                        {Number(firstUnreadId) === Number(m.id) && (
                          <div className="text-center text-[11px] font-700 my-2" style={{ color: "var(--gold)" }}>— {t("trc.newMessages", "New messages")} —</div>
                        )}
                        <div className={"flex " + (mine ? "justify-end" : "justify-start")}>
                          <div className={"chat-bubble " + (mine ? "mine" : "theirs")}>
                            {m.deleted_at
                              ? <p style={{ fontStyle: "italic", opacity: 0.7 }}>{t("trc.deleted", "This message was deleted")}</p>
                              : <p>{m.message}</p>}
                            <div className="text-[10px] mt-0.5 flex items-center justify-end gap-2" style={{ opacity: 0.8 }}>
                              {mine && !m.deleted_at && (
                                <button type="button" onClick={() => removeMessage(m.id)} className="underline">{t("trc.delete", "Delete")}</button>
                              )}
                              <span>{timeOf(m.created_at)}</span>
                              {mine && !m.deleted_at && <span title={m.read_at ? t("trc.seen", "Seen") : t("trc.sent", "Sent")}>{m.read_at ? "✓✓" : "✓"}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t p-3 flex items-end gap-2" style={{ borderColor: "var(--line)" }}>
                  <textarea rows={1} value={draft} maxLength={MAX_LENGTH} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown}
                    placeholder={t("trc.placeholder", "Write a message…")} className="flex-1 rounded-xl border px-3 py-2 text-sm resize-none"
                    style={{ borderColor: "var(--line)", background: "var(--input-bg)", color: "var(--ink)" }} />
                  <button type="button" disabled={sending || !draft.trim()} onClick={send} className="btn-primary px-4 py-2 rounded-xl text-sm font-700">
                    {sending ? "…" : t("trc.send", "Send")}
                  </button>
                </div>
                {draft.length > MAX_LENGTH - 200 && (
                  <div className="px-3 pb-2 text-[11px] text-right" style={{ color: "var(--ink-soft)" }}>{draft.length}/{MAX_LENGTH}</div>
                )}
                {/* @@composer */}
              </>
            ) : (
              <div className="flex-1 grid place-items-center p-6 text-sm text-center" style={{ color: "var(--ink-soft)" }}>
                {t("trc.pick", "Pick a chat on the left to read it.")}
              </div>
            )}
            {/* @@view */}
          </section>
        </div>
      </div>
    );
  }

  // @@exports
  window.CDComponents = window.CDComponents || {};
  window.CDComponents.TeacherRiderChat = TeacherRiderChat;
})();
