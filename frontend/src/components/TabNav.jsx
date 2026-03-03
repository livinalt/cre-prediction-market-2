export default function TabNav({ active, onChange, counts, isMobile }) {
  const tabs = [
    { key: "all",       label: "All Markets",  count: counts.all       },
    { key: "mine",      label: "My Markets",   count: counts.mine      },
    { key: "positions", label: "Positions",    count: counts.positions  },
  ];

  return (
    <div style={{
      display: "flex", gap: 3, marginBottom: 24,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10, padding: 3,
      width: isMobile ? "100%" : "fit-content",
    }}>
      {tabs.map(t => {
        const isActive = active === t.key;
        return (
          <div key={t.key} onClick={() => onChange(t.key)}
            style={{
              flex: isMobile ? 1 : "none",
              padding: isMobile ? "7px 8px" : "7px 16px",
              borderRadius: 8, cursor: "pointer",
              fontFamily: "var(--mono)", fontSize: isMobile ? 10 : 11,
              fontWeight: isActive ? 600 : 400,
              background: isActive ? "rgba(255,255,255,0.07)" : "transparent",
              color: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
              border: `1px solid ${isActive ? "rgba(255,255,255,0.1)" : "transparent"}`,
              transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              userSelect: "none", whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{
                background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
                color: isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)",
                border: `1px solid ${isActive ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 99, padding: "0px 6px", fontSize: 9, fontWeight: 700,
              }}>{t.count}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}