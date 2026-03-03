function timeAgo(timestamp) {
  const diff  = Date.now() - timestamp;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function NotificationItem({ n, onDismissSettlement, onClaimClick }) {
  const isPending   = n.status === "pending";
  const isStale     = n.status === "stale";
  const isDismissed = n.status === "dismissed";
  const isResolved  = n.status === "resolved";

  const bg = isPending ? "rgba(124,106,247,0.04)" : isStale ? "rgba(245,158,11,0.04)" : "transparent";
  const leftBorder = isDismissed ? "transparent"
    : isPending ? "rgba(124,106,247,0.4)"
    : isStale   ? "rgba(245,158,11,0.4)"
    : !n.read   ? (n.color || "rgba(124,106,247,0.4)")
    : "transparent";

  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: bg, borderLeft: `2px solid ${leftBorder}`, opacity: isDismissed ? 0.45 : 1, transition: "all 0.15s", cursor: n.action === "claim" ? "pointer" : "default" }}
      onClick={() => { if (n.action === "claim" && onClaimClick) onClaimClick(n.marketId); }}
      onMouseEnter={e => { if (n.action === "claim") e.currentTarget.style.background = "rgba(34,197,94,0.05)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = bg; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>

        {/* Icon */}
        <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: `${n.color || "rgba(124,106,247,1)"}12`, border: `1px solid ${n.color || "rgba(124,106,247,0.3)"}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, animation: isPending ? "spin 2s linear infinite" : "none" }}>
          {isPending ? "⟳" : n.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: isDismissed || n.read ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.8)", lineHeight: 1.4 }}>
              {n.title}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              {isPending && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(167,139,250,0.7)", display: "inline-block", animation: "subtlePulse 1.8s ease-in-out infinite" }} />}
              {isStale   && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(245,158,11,0.7)", display: "inline-block" }} />}
              {isResolved && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(34,197,94,0.7)", display: "inline-block" }} />}
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
                {timeAgo(n.timestamp)}
              </span>
            </div>
          </div>

          {n.detail && (
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 3, lineHeight: 1.5, wordBreak: "break-word" }}>
              {n.detail}
            </div>
          )}

          {isPending && (
            <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, height: 2, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: "60%", background: "rgba(167,139,250,0.5)", borderRadius: 99, animation: "progressSlide 1.8s ease-in-out infinite" }} />
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(167,139,250,0.6)", flexShrink: 0 }}>CRE running…</span>
            </div>
          )}

          {isStale && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ padding: "7px 10px", borderRadius: 7, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", fontFamily: "var(--mono)", fontSize: 9, color: "rgba(245,158,11,0.75)", lineHeight: 1.6 }}>
                CRE didn't respond in 5m — Gemini quota may be exhausted.{" "}
                <a href="https://aistudio.google.com" target="_blank" rel="noreferrer"
                  style={{ color: "rgba(245,158,11,0.85)", textDecoration: "underline" }}
                  onClick={e => e.stopPropagation()}
                >
                  Check quota ↗
                </a>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div onClick={e => { e.stopPropagation(); onDismissSettlement(n.id, n.marketId); }}
                  style={{ padding: "4px 10px", borderRadius: 6, cursor: "pointer", border: "1px solid rgba(255,255,255,0.07)", background: "transparent", fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,0.3)", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
                >
                  Dismiss
                </div>
              </div>
            </div>
          )}

          {isResolved && (
            <div style={{ marginTop: 4, fontFamily: "var(--mono)", fontSize: 9, color: "rgba(74,222,128,0.6)" }}>
              ✓ CRE responded successfully
            </div>
          )}

          {n.action === "claim" && (
            <div style={{ marginTop: 5, fontFamily: "var(--mono)", fontSize: 10, color: "rgba(74,222,128,0.7)", fontWeight: 600 }}>
              Tap to claim winnings →
            </div>
          )}
        </div>

        {!n.read && !isDismissed && (
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: n.color || "rgba(124,106,247,0.7)", flexShrink: 0, marginTop: 5 }} />
        )}
      </div>
    </div>
  );
}

export default function NotificationPanel({ notifications, unreadCount, onMarkAllRead, onClearAll, onClose, onClaimClick, onDismissSettlement }) {
  const pendingCount = notifications.filter(n => n.status === "pending").length;
  const staleCount   = notifications.filter(n => n.status === "stale").length;

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={onClose} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(380px, 100vw)", zIndex: 200,
        background: "#111111",
        borderLeft: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column",
        boxShadow: "-24px 0 60px rgba(0,0,0,0.6)",
        animation: "slideInRight 0.18s ease",
      }}>

        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", rowGap: 5 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: "rgba(255,255,255,0.4)" }}><path d="M7 1.5C5 1.5 3.5 3 3.5 5v3L2 9.5h10L10.5 8V5C10.5 3 9 1.5 7 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M5.5 10.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.3, color: "rgba(255,255,255,0.8)" }}>Notifications</span>
            {unreadCount > 0 && (
              <span style={{ background: "rgba(124,106,247,0.2)", color: "rgba(167,139,250,0.9)", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99, fontFamily: "var(--mono)", border: "1px solid rgba(124,106,247,0.25)" }}>
                {unreadCount}
              </span>
            )}
            {pendingCount > 0 && (
              <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: "rgba(167,139,250,0.6)", background: "rgba(124,106,247,0.07)", padding: "1px 6px", borderRadius: 99, border: "1px solid rgba(124,106,247,0.15)" }}>
                {pendingCount} pending
              </span>
            )}
            {staleCount > 0 && (
              <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: "rgba(245,158,11,0.7)", background: "rgba(245,158,11,0.06)", padding: "1px 6px", borderRadius: 99, border: "1px solid rgba(245,158,11,0.15)" }}>
                {staleCount} stale
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {unreadCount > 0 && (
              <div onClick={onMarkAllRead}
                style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,255,255,0.25)", cursor: "pointer", padding: "4px 7px", borderRadius: 6, transition: "all 0.15s", whiteSpace: "nowrap" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}
              >
                Mark read
              </div>
            )}
            {notifications.length > 0 && (
              <div onClick={onClearAll}
                style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,255,255,0.25)", cursor: "pointer", padding: "4px 7px", borderRadius: 6, transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.07)"; e.currentTarget.style.color = "rgba(248,113,113,0.7)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}
              >
                Clear
              </div>
            )}
            <div onClick={onClose}
              style={{ width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.25)", fontSize: 12, transition: "all 0.15s", marginLeft: 2 }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}
            >✕</div>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {notifications.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none" style={{ color: "rgba(255,255,255,0.2)" }}><path d="M7 1.5C5 1.5 3.5 3 3.5 5v3L2 9.5h10L10.5 8V5C10.5 3 9 1.5 7 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M5.5 10.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>No notifications yet</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,255,255,0.15)", textAlign: "center", maxWidth: 200, lineHeight: 1.6 }}>
                Predictions, settlements and claims appear here
              </span>
            </div>
          ) : (
            notifications.map(n => (
              <NotificationItem key={n.id} n={n} onDismissSettlement={onDismissSettlement} onClaimClick={onClaimClick} />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,255,255,0.15)", textAlign: "center" }}>
            Notifications stored locally · Hackathon build
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes subtlePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes progressSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
      `}</style>
    </>
  );
}