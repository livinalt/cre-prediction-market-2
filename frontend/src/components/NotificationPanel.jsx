// src/components/NotificationPanel.jsx

function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function NotificationPanel({ notifications, unreadCount, onMarkAllRead, onClearAll, onClose, onClaimClick }) {
  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 199 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        position: "fixed",
        top: 0, right: 0, bottom: 0,
        width: "min(380px, 100vw)",
        zIndex: 200,
        background: "var(--surface, #0d1117)",
        borderLeft: "1px solid var(--border2, #30363d)",
        display: "flex", flexDirection: "column",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
        animation: "slideInRight 0.2s ease",
      }}>

        {/* Panel header */}
        <div style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔔</span>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.3 }}>Notifications</span>
            {unreadCount > 0 && (
              <span style={{
                background: "#7c6af7", color: "#fff",
                fontSize: 10, fontWeight: 700,
                padding: "1px 6px", borderRadius: 99,
                fontFamily: "var(--mono)",
              }}>{unreadCount}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {unreadCount > 0 && (
              <div
                onClick={onMarkAllRead}
                style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", cursor: "pointer", padding: "4px 8px", borderRadius: 6, transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "var(--text)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted)"; }}
              >
                Mark all read
              </div>
            )}
            {notifications.length > 0 && (
              <div
                onClick={onClearAll}
                style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", cursor: "pointer", padding: "4px 8px", borderRadius: 6, transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "#ef4444"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted)"; }}
              >
                Clear all
              </div>
            )}
            <div
              onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--muted)", fontSize: 14, transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted)"; }}
            >✕</div>
          </div>
        </div>

        {/* Notification list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {notifications.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "100%", gap: 12, color: "var(--muted)",
            }}>
              <span style={{ fontSize: 32, opacity: 0.3 }}>🔔</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>No notifications yet</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, opacity: 0.6, textAlign: "center", maxWidth: 220, lineHeight: 1.6 }}>
                Activity from predictions, settlements and claims will appear here
              </span>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border)",
                  background: n.read ? "transparent" : "rgba(124,106,247,0.04)",
                  borderLeft: `3px solid ${n.read ? "transparent" : n.color || "#7c6af7"}`,
                  transition: "background 0.15s",
                  cursor: n.action === "claim" ? "pointer" : "default",
                }}
                onClick={() => { if (n.action === "claim" && onClaimClick) onClaimClick(n.marketId); }}
                onMouseEnter={e => { if (n.action === "claim") e.currentTarget.style.background = "rgba(34,211,165,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = n.read ? "transparent" : "rgba(124,106,247,0.04)"; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  {/* Icon */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: `${n.color || "#7c6af7"}15`,
                    border: `1px solid ${n.color || "#7c6af7"}25`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13,
                  }}>
                    {n.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: n.read ? "var(--muted)" : "var(--text)",
                        lineHeight: 1.4,
                      }}>
                        {n.title}
                      </span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", flexShrink: 0, marginTop: 2 }}>
                        {timeAgo(n.timestamp)}
                      </span>
                    </div>
                    {n.detail && (
                      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginTop: 3, lineHeight: 1.5, wordBreak: "break-word" }}>
                        {n.detail}
                      </div>
                    )}
                    {n.action === "claim" && (
                      <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 10, color: "#22d3a5", fontWeight: 600 }}>
                        Tap to claim winnings →
                      </div>
                    )}
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: n.color || "#7c6af7", flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", textAlign: "center" }}>
            Notifications stored locally · Last 50 events
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}