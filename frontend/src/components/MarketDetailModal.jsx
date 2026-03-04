import { useState, useEffect } from "react";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import { client } from "../App";
import { MARKET_ADDRESS, MARKET_ABI } from "../lib/contracts";
import { fmtEth, calcProb } from "../lib/utils";
import { notify } from "../lib/useNotifications";
import { isDateReached } from "./MarketCard";

// Multiple gateways for fallback resilience
const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

/**
 * Fetch description from IPFS CID.
 * Tries each gateway in order, returns description string or null.
 * Results are cached in memory to avoid redundant fetches.
 */
const descriptionCache = {};

async function fetchDescriptionFromIPFS(cid) {
  if (!cid) return null;
  if (descriptionCache[cid] !== undefined) return descriptionCache[cid];

  for (const gateway of IPFS_GATEWAYS) {
    try {
      const res = await fetch(`${gateway}${cid}`, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const data = await res.json();
      const desc = data?.description ?? null;
      descriptionCache[cid] = desc;
      return desc;
    } catch {
      // try next gateway
    }
  }

  descriptionCache[cid] = null; // cache miss so we don't keep retrying
  return null;
}

function fmtConfidence(raw) {
  if (!raw && raw !== 0) return "—";
  return (raw / 100).toFixed(0) + "%";
}

function timeAgo(ts) {
  if (!ts) return "—";
  const diff  = Date.now() - ts * 1000;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function MarketDetailModal({ market, userPosition, onClose, onRefresh, onPollSettled, onToast, onNotify }) {
  if (!market) return null;

  const account = useActiveAccount();
  const { mutate: sendTx, isPending } = useSendTransaction();
  const [settling,     setSettling]     = useState(false);
  const [claiming,     setClaiming]     = useState(false);
  const [predicting,   setPredicting]   = useState(null);
  const [description,  setDescription]  = useState(null);   // null = loading, "" = none
  const [descLoading,  setDescLoading]  = useState(false);

  // ── Fetch description from IPFS on mount / when CID changes ──
  useEffect(() => {
    const cid = market.descriptionCID;

    // Fallback: old markets (before IPFS) may have localStorage description
    if (!cid) {
      const local = localStorage.getItem(`market_desc_${market.id}`);
      setDescription(local || "");
      return;
    }

    setDescLoading(true);
    fetchDescriptionFromIPFS(cid)
      .then(desc => setDescription(desc ?? ""))
      .catch(() => setDescription(""))
      .finally(() => setDescLoading(false));
  }, [market.descriptionCID, market.id]);

  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

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

  const toast    = (msg, kind = "info") => onToast?.(msg, kind);
  const contract = getContract({ client, chain: sepolia, address: MARKET_ADDRESS, abi: MARKET_ABI });

  const isPendingSettlement = !!localStorage.getItem(`pending_settlement_${market.id}`);
  const isOpen    = !market.settled;
  const yesPool   = Number(market.totalYesPool  ?? 0);
  const noPool    = Number(market.totalNoPool   ?? 0);
  const totalPool = isNaN(yesPool + noPool) ? 0 : (yesPool + noPool) / 1e18;
  const prob      = calcProb(yesPool, noPool);
  const hasPos    = !!userPosition;
  const userWon   = hasPos && market.settled &&
    Number(userPosition.prediction) === Number(market.outcome) && !userPosition.claimed;
  const isCreator = account?.address?.toLowerCase() === market.creator?.toLowerCase();
  const canSettle = isOpen && (isCreator || hasPos);
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

  const BTNS = [
    { label: "Yes", side: 0, color: "#4ade80", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.25)"  },
    { label: "No",  side: 1, color: "#f87171", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.25)"  },
  ];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px 16px",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#111111",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14, width: "100%", maxWidth: 480,
        maxHeight: "min(600px, 90vh)",
        display: "flex", flexDirection: "column",
        boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.04) inset",
        overflow: "hidden",
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: "16px 16px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 12, flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(167,139,250,0.7)" }}>#{market.id}</span>

              {isOpen ? (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--mono)", fontSize: 9, color: isPendingSettlement ? "#f59e0b" : "#4ade80" }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: isPendingSettlement ? "#f59e0b" : "#22c55e",
                    boxShadow: `0 0 5px ${isPendingSettlement ? "#f59e0b60" : "#22c55e60"}`,
                    display: "inline-block",
                    animation: isPendingSettlement ? "subtlePulse 2s ease-in-out infinite" : "none",
                  }} />
                  {isPendingSettlement ? "SETTLING" : "LIVE"}
                </span>
              ) : (
                <span style={{
                  fontFamily: "var(--mono)", fontSize: 9, fontWeight: 600,
                  color: market.outcome === 0 ? "#4ade80" : "#f87171",
                  background: market.outcome === 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                  border: `1px solid ${market.outcome === 0 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                  padding: "2px 7px", borderRadius: 99,
                }}>
                  {market.outcome === 0 ? "YES" : "NO"} · {fmtConfidence(market.confidence)}
                </span>
              )}

              {isCreator && (
                <span style={{ fontSize: 8, color: "rgba(167,139,250,0.6)", background: "rgba(124,106,247,0.08)", border: "1px solid rgba(124,106,247,0.15)", padding: "1px 5px", borderRadius: 99, fontFamily: "var(--mono)" }}>
                  yours
                </span>
              )}
              {hasPos && (
                <span style={{
                  fontSize: 8,
                  color: Number(userPosition.prediction) === 0 ? "#4ade80" : "#f87171",
                  background: Number(userPosition.prediction) === 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                  border: `1px solid ${Number(userPosition.prediction) === 0 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                  padding: "1px 5px", borderRadius: 99, fontFamily: "var(--mono)",
                }}>
                  {Number(userPosition.prediction) === 0 ? "YES" : "NO"} position
                </span>
              )}
            </div>

            <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, letterSpacing: -0.3, margin: 0, color: "rgba(255,255,255,0.85)" }}>
              {market.question}
            </p>
          </div>

          <div onClick={onClose}
            style={{ width: 26, height: 26, borderRadius: 6, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, flexShrink: 0, transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,81,73,0.12)"; e.currentTarget.style.color = "#f85149"; e.currentTarget.style.borderColor = "rgba(248,81,73,0.25)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          >✕</div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Description — loaded from IPFS */}
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              Description
              {/* IPFS badge when CID is present */}
              {market.descriptionCID && (
                <a
                  href={`https://gateway.pinata.cloud/ipfs/${market.descriptionCID}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ display: "flex", alignItems: "center", gap: 3, color: "rgba(34,211,165,0.5)", textDecoration: "none", fontSize: 8 }}
                  onMouseEnter={e => e.currentTarget.style.color = "#22d3a5"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(34,211,165,0.5)"}
                >
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                  IPFS ↗
                </a>
              )}
            </div>

            {descLoading ? (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", margin: 0, fontFamily: "var(--mono)", fontStyle: "italic" }}>
                Loading from IPFS…
              </p>
            ) : description ? (
              <p style={{ fontSize: 12, lineHeight: 1.65, color: "rgba(255,255,255,0.5)", margin: 0, whiteSpace: "pre-wrap" }}>
                {description}
              </p>
            ) : (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", margin: 0, fontFamily: "var(--mono)", fontStyle: "italic" }}>
                No description provided
              </p>
            )}
          </div>

          {/* Prob bar */}
          <div style={{ padding: "2px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "#4ade80", opacity: 0.85 }}>YES {prob}%</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "#f87171", opacity: 0.75 }}>{100 - prob}% NO</span>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: "rgba(239,68,68,0.18)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${prob}%`, background: "linear-gradient(90deg, #22c55e, #4ade80)", borderRadius: 99, transition: "width 0.5s" }} />
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[
              { label: "Pool", value: totalPool.toFixed(4) + " ETH", color: "rgba(255,255,255,0.7)" },
              { label: "YES",  value: (yesPool / 1e18).toFixed(4) + " ETH", color: "#4ade80" },
              { label: "NO",   value: (noPool  / 1e18).toFixed(4) + " ETH", color: "#f87171" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "9px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: s.color, marginBottom: 3 }}>{s.value}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 0.8 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Position */}
          {hasPos && (
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(124,106,247,0.06)", border: "1px solid rgba(124,106,247,0.14)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: "rgba(255,255,255,0.25)", marginBottom: 3 }}>PREDICTED</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700, color: Number(userPosition.prediction) === 0 ? "#4ade80" : "#f87171" }}>
                    {Number(userPosition.prediction) === 0 ? "YES" : "NO"}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: "rgba(255,255,255,0.25)", marginBottom: 3 }}>STAKED</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>
                    {fmtEth(userPosition.amount)} ETH
                  </div>
                </div>
              </div>
              {userPosition.claimed && (
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#4ade80", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)", padding: "2px 8px", borderRadius: 99 }}>
                  claimed ✓
                </span>
              )}
            </div>
          )}

          {/* Meta */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
              Created {timeAgo(market.createdAt)} · {market.creator?.slice(0, 6)}…{market.creator?.slice(-4)}
            </span>
            <a href={`https://sepolia.etherscan.io/address/${MARKET_ADDRESS}`} target="_blank" rel="noreferrer"
              style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(167,139,250,0.6)", textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#a78bfa"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(167,139,250,0.6)"}
              onClick={e => e.stopPropagation()}
            >
              Etherscan ↗
            </a>
          </div>

          {/* Settled banner */}
          {market.settled && (
            <div style={{
              padding: "9px 12px", borderRadius: 8,
              background: market.outcome === 0 ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
              border: `1px solid ${market.outcome === 0 ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: market.outcome === 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                Resolved {market.outcome === 0 ? "YES" : "NO"} · {fmtConfidence(market.confidence)} confidence
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
                {timeAgo(market.settledAt)}
              </span>
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        {(isOpen || userWon) && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>

            {isOpen && !hasPos && (
              <div style={{ display: "flex", gap: 6 }}>
                {BTNS.map(btn => {
                  const isThis   = predicting === btn.side;
                  const isOther  = predicting !== null && predicting !== btn.side;
                  const disabled = predicting !== null || isPending;
                  return (
                    <button key={btn.side} onClick={() => placeBet(btn.side)} disabled={disabled}
                      style={{
                        flex: 1, padding: "9px 0", borderRadius: 7,
                        border: `1px solid ${isThis ? btn.border : "rgba(255,255,255,0.08)"}`,
                        background: isThis ? btn.bg : "rgba(255,255,255,0.03)",
                        color: isThis ? btn.color : isOther ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.55)",
                        fontSize: 12, fontWeight: 600,
                        cursor: disabled ? "not-allowed" : "pointer",
                        transition: "all 0.15s", fontFamily: "var(--sans)",
                      }}
                      onMouseEnter={e => { if (!disabled && !isThis) { e.currentTarget.style.background = btn.bg; e.currentTarget.style.color = btn.color; e.currentTarget.style.borderColor = btn.border; }}}
                      onMouseLeave={e => { if (!disabled && !isThis) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}}
                    >
                      {isThis ? "Confirming…" : `${btn.label} · 0.001 ETH`}
                    </button>
                  );
                })}
              </div>
            )}

            {canSettle && (
              dateOk ? (
                <button onClick={requestSettlement} disabled={settling || isPending}
                  style={{
                    width: "100%", padding: "9px 0", borderRadius: 7,
                    border: "1px solid rgba(245,158,11,0.2)",
                    background: "rgba(245,158,11,0.06)",
                    color: "rgba(245,158,11,0.8)",
                    fontSize: 12, fontWeight: 500,
                    cursor: settling ? "not-allowed" : "pointer",
                    opacity: settling ? 0.5 : 1,
                    transition: "all 0.15s", fontFamily: "var(--sans)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.12)"; e.currentTarget.style.color = "#f59e0b"; e.currentTarget.style.borderColor = "rgba(245,158,11,0.3)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.06)"; e.currentTarget.style.color = "rgba(245,158,11,0.8)"; e.currentTarget.style.borderColor = "rgba(245,158,11,0.2)"; }}
                >
                  {settling ? "Requesting…" : "Request Settlement"}
                </button>
              ) : (
                <div style={{
                  width: "100%", padding: "9px 0", borderRadius: 7, textAlign: "center",
                  border: "1px solid rgba(255,255,255,0.05)",
                  background: "rgba(255,255,255,0.02)",
                  fontFamily: "var(--mono)", fontSize: 11,
                  color: "rgba(255,255,255,0.2)",
                }}>
                  🕐 Resolution date not reached yet
                </div>
              )
            )}

            {userWon && (
              <button onClick={claimWinnings} disabled={claiming}
                style={{
                  width: "100%", padding: "9px 0", borderRadius: 7,
                  border: "1px solid rgba(34,197,94,0.25)",
                  background: "rgba(34,197,94,0.1)",
                  color: "#4ade80", fontSize: 12, fontWeight: 600,
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
              <div style={{ textAlign: "center", fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,255,255,0.2)", padding: "2px 0" }}>winnings claimed ✓</div>
            )}
            {hasPos && market.settled && Number(userPosition.prediction) !== Number(market.outcome) && (
              <div style={{ textAlign: "center", fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,255,255,0.2)", padding: "2px 0" }}>better luck next time</div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes subtlePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}