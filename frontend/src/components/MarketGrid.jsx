import MarketCard from "./MarketCard";

export default function MarketGrid({ markets, positions, onRefresh, onPollSettled, showEmpty, onToast, onNotify, isMobile, isTablet }) {
  const cols = isMobile ? 1 : isTablet ? 2 : 3;

  if (!markets.length && showEmpty) {
    return (
      <div style={{
        padding: "48px 24px",
        textAlign: "center",
        borderRadius: 12,
        background: "rgba(255,255,255,0.01)",
        border: "1px dashed rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, marginBottom: 2,
        }}>
          ◈
        </div>
        <p style={{
          fontFamily: "var(--sans)", fontSize: 13, fontWeight: 500,
          color: "rgba(255,255,255,0.5)", margin: 0,
        }}>
          No markets yet
        </p>
        <p style={{
          fontFamily: "var(--mono)", fontSize: 11,
          color: "rgba(255,255,255,0.25)", margin: 0,
        }}>
          Create the first one to get started
        </p>
      </div>
    );
  }

  if (!markets.length) return null;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: isMobile ? 8 : 12,
    }}>
      {markets.map(m => (
        <MarketCard
          key={m.id}
          market={m}
          userPosition={positions[m.id]}
          onRefresh={onRefresh}
          onPollSettled={onPollSettled}
          onToast={onToast}
          onNotify={onNotify}
        />
      ))}
    </div>
  );
}