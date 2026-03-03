export default function StatsBar({ total, open, volume, positions, userVolume, userWins, isMobile, account }) {

  const fmtEth = (wei) => {
    const eth = Number(BigInt(wei || 0)) / 1e18;
    return eth === 0 ? "0.0000" : eth.toFixed(4);
  };

  const platformStats = [
    { label: "Markets",    value: total ?? "—" },
    { label: "Open",       value: open  ?? "—" },
    { label: "Volume",     value: volume > 0 ? fmtEth(volume) + " ETH" : "0.0000 ETH" },
    { label: "Settlement", value: "CRE ⚡" },
  ];

  const positionCount = Object.keys(positions || {}).length;
  const hasActivity   = account && positionCount > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>

      {/* Platform stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        overflow: "hidden",
        background: "rgba(255,255,255,0.01)",
      }}>
        {platformStats.map((s, i) => (
          <div key={i} style={{
            padding: isMobile ? "10px 12px" : "12px 16px",
            borderRight: i !== platformStats.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
            borderBottom: isMobile && i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}>
            <div style={{
              fontSize: 9, color: "rgba(255,255,255,0.3)",
              fontFamily: "var(--mono)", letterSpacing: 1,
              textTransform: "uppercase", marginBottom: 5,
            }}>
              {s.label}
            </div>
            <div style={{
              fontSize: isMobile ? 14 : 16, fontWeight: 600,
              letterSpacing: -0.3, color: "rgba(255,255,255,0.85)",
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Personal stats — only when wallet connected + has positions */}
      {hasActivity && (
        <div style={{
          display: "flex", alignItems: "center",
          gap: isMobile ? 12 : 20,
          padding: "9px 14px", borderRadius: 8,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          flexWrap: "wrap",
        }}>
          <span style={{
            fontFamily: "var(--mono)", fontSize: 9,
            color: "rgba(255,255,255,0.25)",
            textTransform: "uppercase", letterSpacing: 1, flexShrink: 0,
          }}>
            Your activity
          </span>

          <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.06)" }} />

          {[
            { label: "Positions", value: positionCount },
            { label: "Staked",    value: fmtEth(userVolume) + " ETH" },
            { label: "Won",       value: `${userWins ?? 0} market${userWins !== 1 ? "s" : ""}` },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                {s.label}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                {s.value}
              </span>
              {i < 2 && <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.06)", marginLeft: 6 }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}