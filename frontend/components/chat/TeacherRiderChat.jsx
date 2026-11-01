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

  function TeacherRiderChat({ role, userId, apiBase, token, tx, refreshKey = 0 }) {
    const t = makeT(tx);
    const isTeacher = role === "teacher";
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [peer, setPeer] = useState(null); // the person whose chat is open: { id, name, role, external_id }
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
    // @@actions

    const openThread = (thread) => {
      setPeer({ id: thread.peer_id, name: thread.name, role: thread.role, external_id: thread.external_id });
    };
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
