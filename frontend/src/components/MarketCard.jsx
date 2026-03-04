import { useState, useEffect } from "react";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import { client } from "../App";
import { MARKET_ADDRESS, MARKET_ABI } from "../lib/contracts";
import { fmtEth, calcProb } from "../lib/utils";
import { notify } from "../lib/useNotifications";
import MarketDetailModal from "./MarketDetailModal";

// ── shared with MarketDetailModal ──
export function isDateReached(question) {
  const q = question || "";
  const patterns = [
    /on (\w+ \d{1,2},?\s*\d{4})/i,
    /(\w+ \d{1,2},?\s*\d{4})/i,
    /(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/,
    /end of (\d{4})/i,
    /by (\w+ \d{4})/i,
    /before (\w+ \d{4})/i,
  ];
  for (const p of patterns) {
    const match = q.match(p);
    if (match) {
      const parsed = new Date(match[1] || match[0]);
      if (!isNaN(parsed)) return parsed <= new Date();
    }
  }
  return true;
}

export default function MarketCard({ market, userPosition, onRefresh, onPollSettled, onToast, onNotify }) {
  const account = useActiveAccount();
  const { mutate: sendTx, isPending } = useSendTransaction();
  const [predicting, setPredicting] = useState(null);
  const [settling,   setSettling]   = useState(false);
  const [claiming,   setClaiming]   = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const toast    = (msg, kind = "info") => onToast?.(msg, kind);
  const contract = getContract({ client, chain: sepolia, address: MARKET_ADDRESS, abi: MARKET_ABI });

  // ── clear stale pending key ──
  useEffect(() => {
    if (market.settled) {
      localStorage.removeItem(`pending_settlement_${market.id}`);
      return;
    }
    const stored = localStorage.getItem(`pending_settlement_${market.id}`);
    if (stored && Date.now() - Number(stored) > 10 * 60 * 1000) {
      localStorage.removeItem(`pending_settlement_${market.id}`);
    }
  }, [market.settled, market.id]);

  const isPendingSettlement = !!localStorage.getItem(`pending_settlement_${market.id}`);

  const isOpen    = !market.settled;
  const yesPool   = Number(market.totalYesPool  ?? 0);
  const noPool    = Number(market.totalNoPool   ?? 0);
  const prob      = calcProb(yesPool, noPool);
  const hasPos    = !!userPosition;
  const userWon   = hasPos && market.settled &&
    Number(userPosition.prediction) === Number(market.outcome) && !userPosition.claimed;
  const isCreator = account?.address?.toLowerCase() === market.creator?.toLowerCase();
  const canSettle = isOpen && (isCreator || hasPos);
  const totalPool = ((yesPool + noPool) / 1e18).toFixed(4);
  const dateOk    = isDateReached(market.question);

  function placeBet(side) {
    if (!account || hasPos || predicting !== null) return;
    setPredicting(side);
    let tx;
    try {
      tx = prepareContractCall({
        contract, method: "predict",
        params: [BigInt(market.id), side],
        value: BigInt(1_000_000_000_000_000),
      });
    } catch { toast("Failed to prepare tx", "error"); setPredicting(null); return; }
    toast("Confirm in wallet…", "info");
    sendTx(tx, {
      onSuccess: () => {
        toast("Prediction placed ✓", "success");
        onNotify?.(notify.predicted(market.id, side, 1_000_000_000_000_000));
        setTimeout(() => onRefresh(true), 2000);
        setPredicting(null);
      },
      onError: e => { toast(e.message.slice(0, 60), "error"); setPredicting(null); },
    });
  }

  function requestSettlement() {
    if (!account) return;
    setSettling(true);
    let tx;
    try {
      tx = prepareContractCall({ contract, method: "requestSettlement", params: [BigInt(market.id)] });
    } catch { toast("Failed to prepare tx", "error"); setSettling(false); return; }
    toast("Requesting AI settlement…", "info");
    sendTx(tx, {
      onSuccess: () => {
        toast("Settlement requested ✓ — CRE is processing…", "success");
        localStorage.setItem(`pending_settlement_${market.id}`, Date.now().toString());
        onNotify?.(notify.settlementRequested(market.id, market.question));
        // ── use direct viem polling — bypasses Thirdweb cache ──
        onPollSettled?.(market.id);
        setSettling(false);
      },
      onError: e => { toast(e.message.slice(0, 60), "error"); setSettling(false); },
    });
  }

  function claimWinnings() {
    if (!account) return;
    setClaiming(true);
    let tx;
    try {
      tx = prepareContractCall({ contract, method: "claim", params: [BigInt(market.id)] });
    } catch { toast("Failed to prepare tx", "error"); setClaiming(false); return; }
    toast("Claiming winnings…", "info");
    sendTx(tx, {
      onSuccess: () => {
        toast("Winnings claimed ✓", "success");
        onNotify?.(notify.claimed(market.id, userPosition?.amount ?? 0));
        setTimeout(() => onRefresh(true), 2000);
        setClaiming(false);
      },
      onError: e => { toast(e.message.slice(0, 60), "error"); setClaiming(false); },
    });
  }

  const accentColor = !isOpen
    ? (market.outcome === 0 ? "#22c55e" : "#ef4444")
    : isPendingSettlement ? "#f59e0b"
    : hasPos ? "#7c6af7"
    : "transparent";

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        style={{
          background: "#111111",
          border: "1px solid rgba(255,255,255,0.07)",
          borderTop: `2px solid ${accentColor}`,
          borderRadius: 10,
          display: "flex", flexDirection: "column",
          cursor: "pointer",
          transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
          overflow: "hidden",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.13)";
          e.currentTarget.style.boxShadow   = "0 6px 24px rgba(0,0,0,0.45)";
          e.currentTarget.style.transform   = "translateY(-1px)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
          e.currentTarget.style.boxShadow   = "none";
          e.currentTarget.style.transform   = "none";
        }}
      >
        {/* Position strip */}
        {hasPos && (
          <div style={{
            padding: "4px 12px",
            background: "rgba(124,106,247,0.08)",
            borderBottom: "1px solid rgba(124,106,247,0.12)",
            fontFamily: "var(--mono)", fontSize: 9,
            color: "rgba(167,139,250,0.7)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{
              width: 4, height: 4, borderRadius: "50%",
              background: Number(userPosition.prediction) === 0 ? "#a78bfa" : "rgba(167,139,250,0.4)",
              display: "inline-block", flexShrink: 0,
            }} />
            {Number(userPosition.prediction) === 0 ? "YES" : "NO"} · {fmtEth(userPosition.amount)} ETH
            {userPosition.claimed && " · claimed"}
          </div>
        )}

        {/* Header */}
        <div style={{ padding: "14px 14px 8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
              #{market.id}
            </span>

            {isOpen ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {isPendingSettlement && (
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#f59e0b", opacity: 0.8 }}>settling</span>
                )}
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: isPendingSettlement ? "#f59e0b" : "#22c55e",
                  display: "inline-block",
                  boxShadow: isPendingSettlement ? "0 0 5px #f59e0b60" : "0 0 5px #22c55e60",
                  animation: isPendingSettlement ? "subtlePulse 2s ease-in-out infinite" : "none",
                }} />
              </div>
            ) : (
              <span style={{
                fontFamily: "var(--mono)", fontSize: 9, fontWeight: 600,
                color: market.outcome === 0 ? "#4ade80" : "#f87171",
                background: market.outcome === 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${market.outcome === 0 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                padding: "2px 7px", borderRadius: 99,
              }}>
                {market.outcome === 0 ? "YES" : "NO"} · {(market.confidence / 100).toFixed(0)}%
              </span>
            )}
          </div>

          <p style={{
            fontSize: 13, fontWeight: 600, lineHeight: 1.45,
            letterSpacing: -0.2, color: "rgba(255,255,255,0.82)",
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: "2.9em",
          }}>
            {market.question}
          </p>
        </div>

        {/* Prob bar */}
        <div style={{ padding: "0 14px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "#4ade80", opacity: 0.8 }}>YES {prob}%</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "#f87171", opacity: 0.7 }}>{100 - prob}%</span>
          </div>
          <div style={{ height: 3, borderRadius: 99, background: "rgba(239,68,68,0.2)", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${prob}%`,
              background: "linear-gradient(90deg, #22c55e, #4ade80)",
              borderRadius: 99, transition: "width 0.5s ease",
            }} />
          </div>
        </div>

        {/* Pool stat */}
        <div style={{
          padding: "8px 14px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
            {totalPool} ETH pool
          </span>
          {isCreator && (
            <span style={{
              fontFamily: "var(--mono)", fontSize: 9,
              color: "rgba(167,139,250,0.6)",
              background: "rgba(124,106,247,0.08)",
              border: "1px solid rgba(124,106,247,0.15)",
              padding: "1px 6px", borderRadius: 99,
            }}>
              yours
            </span>
          )}
        </div>

        {/* Actions */}
        <div
          style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 5 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Bet buttons */}
          {isOpen && !hasPos && (
            <div style={{ display: "flex", gap: 5 }}>
              {[
                { label: "Yes", side: 0, activeColor: "#22c55e", activeBg: "rgba(34,197,94,0.12)", activeBorder: "rgba(34,197,94,0.3)" },
                { label: "No",  side: 1, activeColor: "#ef4444", activeBg: "rgba(239,68,68,0.12)", activeBorder: "rgba(239,68,68,0.3)" },
              ].map(btn => {
                const isThis   = predicting === btn.side;
                const isOther  = predicting !== null && predicting !== btn.side;
                const disabled = predicting !== null || isPending;
                return (
                  <button key={btn.side} onClick={() => placeBet(btn.side)} disabled={disabled}
                    style={{
                      flex: 1, padding: "7px 0", borderRadius: 7,
                      border: `1px solid ${isThis ? btn.activeBorder : "rgba(255,255,255,0.08)"}`,
                      background: isThis ? btn.activeBg : "rgba(255,255,255,0.03)",
                      color: isThis ? btn.activeColor : isOther ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.55)",
                      fontSize: 11, fontWeight: 600,
                      cursor: disabled ? "not-allowed" : "pointer",
                      transition: "all 0.15s", fontFamily: "var(--sans)",
                    }}
                    onMouseEnter={e => { if (!disabled && !isThis) { e.currentTarget.style.background = btn.activeBg; e.currentTarget.style.color = btn.activeColor; e.currentTarget.style.borderColor = btn.activeBorder; }}}
                    onMouseLeave={e => { if (!disabled && !isThis) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}}
                  >
                    {isThis ? "Confirming…" : btn.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Settlement — gated by date */}
          {canSettle && (
            dateOk ? (
              <button onClick={e => { e.stopPropagation(); requestSettlement(); }} disabled={settling || isPending}
                style={{
                  width: "100%", padding: "7px 0", borderRadius: 7,
                  border: "1px solid rgba(245,158,11,0.2)",
                  background: "rgba(245,158,11,0.06)",
                  color: "rgba(245,158,11,0.7)",
                  fontSize: 11, fontWeight: 500,
                  cursor: settling ? "not-allowed" : "pointer",
                  opacity: settling ? 0.5 : 1,
                  transition: "all 0.15s", fontFamily: "var(--sans)",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.12)"; e.currentTarget.style.color = "#f59e0b"; e.currentTarget.style.borderColor = "rgba(245,158,11,0.35)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.06)"; e.currentTarget.style.color = "rgba(245,158,11,0.7)"; e.currentTarget.style.borderColor = "rgba(245,158,11,0.2)"; }}
              >
                {settling ? "Requesting…" : "Request Settlement"}
              </button>
            ) : (
              <div style={{
                width: "100%", padding: "7px 0", borderRadius: 7, textAlign: "center",
                border: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(255,255,255,0.02)",
                fontFamily: "var(--mono)", fontSize: 10,
                color: "rgba(255,255,255,0.2)",
              }}>
                🕐 Resolution date not reached
              </div>
            )
          )}

          {/* Claim */}
          {userWon && (
            <button onClick={e => { e.stopPropagation(); claimWinnings(); }} disabled={claiming}
              style={{
                width: "100%", padding: "7px 0", borderRadius: 7,
                border: "1px solid rgba(34,197,94,0.3)",
                background: "rgba(34,197,94,0.1)",
                color: "#4ade80", fontSize: 11, fontWeight: 600,
                cursor: claiming ? "not-allowed" : "pointer",
                opacity: claiming ? 0.5 : 1,
                transition: "all 0.15s", fontFamily: "var(--sans)",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(34,197,94,0.18)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(34,197,94,0.1)"; }}
            >
              {claiming ? "Claiming…" : "Claim Winnings"}
            </button>
          )}

          {hasPos && market.settled && userPosition.claimed && (
            <div style={{ textAlign: "center", fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,255,255,0.2)", padding: "3px 0" }}>claimed</div>
          )}
          {hasPos && market.settled && Number(userPosition.prediction) !== Number(market.outcome) && (
            <div style={{ textAlign: "center", fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,255,255,0.2)", padding: "3px 0" }}>better luck next time</div>
          )}
        </div>
      </div>

      {showDetail && market && (
        <MarketDetailModal
          market={market}
          userPosition={userPosition}
          onClose={() => setShowDetail(false)}
          onRefresh={onRefresh}
          onPollSettled={onPollSettled}
          onToast={onToast}
          onNotify={onNotify}
        />
      )}

      <style>{`
        @keyframes subtlePulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>
    </>
  );
}