import { useState, useEffect } from "react";
import { ConnectButton } from "thirdweb/react";
import { sepolia } from "thirdweb/chains";
import { client } from "../App";
import { MARKET_ADDRESS } from "../lib/contracts";
import HowItWorksModal from "./HowItWorks";

const CONTRACTS = [{ name: "PredictionMarket.sol", addr: MARKET_ADDRESS }];

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const handle = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  return width;
}

const ghostBtn = {
  fontFamily: "var(--mono)", fontSize: 11,
  padding: "6px 10px", borderRadius: 6,
  border: "none", background: "transparent",
  color: "rgba(255,255,255,0.35)", cursor: "pointer",
  userSelect: "none", transition: "color 0.15s",
  display: "flex", alignItems: "center", gap: 5,
};

export default function Header({ onRefresh, loading, onCreateMarket, unreadCount = 0, onOpenNotifications }) {
  const width    = useWindowWidth();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  const [showContracts,  setShowContracts]  = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <>
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,10,0.92)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: isMobile ? "0 14px" : "0 32px",
        height: isMobile ? 52 : 58,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 7,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, color: "rgba(255,255,255,0.7)", flexShrink: 0,
          }}>◈</div>
          <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, letterSpacing: -0.4, color: "rgba(255,255,255,0.85)" }}>
            Rev
          </span>
          {!isMobile && (
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,255,255,0.2)", marginLeft: 2 }}>
              / Markets
            </span>
          )}
        </div>

        {/* Desktop nav */}
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {/* Chain */}
            <div style={{ ...ghostBtn, gap: 6, cursor: "default", marginRight: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e60", display: "inline-block" }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                {isTablet ? "Sepolia" : "Ethereum Sepolia"}
              </span>
            </div>

            {!isTablet && (
              <div onClick={() => setShowHowItWorks(true)} style={ghostBtn}
                onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}
              >
                How it works
              </div>
            )}

            {/* Contracts dropdown */}
            <div style={{ position: "relative" }}>
              <div onClick={() => setShowContracts(v => !v)} style={ghostBtn}
                onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
                onMouseLeave={e => { if (!showContracts) e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
              >
                Contracts
                <span style={{ fontSize: 7, display: "inline-block", transform: showContracts ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
              </div>
              {showContracts && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setShowContracts(false)} />
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", right: 0,
                    background: "#111111",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10, padding: 6, zIndex: 100,
                    minWidth: 270, boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
                  }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1.2, padding: "4px 8px 8px" }}>
                      Ethereum Sepolia
                    </div>
                    {CONTRACTS.map(c => (
                      <a key={c.addr}
                        href={`https://sepolia.etherscan.io/address/${c.addr}`}
                        target="_blank" rel="noreferrer"
                        onClick={() => setShowContracts(false)}
                        style={{ display: "flex", flexDirection: "column", gap: 2, padding: "9px 10px", borderRadius: 7, textDecoration: "none", transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>{c.name}</span>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "rgba(167,139,250,0.6)" }}>{c.addr.slice(0, 10)}...{c.addr.slice(-6)} ↗</span>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Bell */}
            <div onClick={onOpenNotifications} style={{ ...ghostBtn, position: "relative", padding: "6px 8px" }}
              onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5C5 1.5 3.5 3 3.5 5v3L2 9.5h10L10.5 8V5C10.5 3 9 1.5 7 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M5.5 10.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {unreadCount > 0 && (
                <span style={{
                  position: "absolute", top: 3, right: 3,
                  minWidth: 13, height: 13, borderRadius: 99,
                  background: "#7c6af7", color: "#fff",
                  fontSize: 7, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--mono)", padding: "0 3px",
                  border: "1.5px solid #0a0a0a",
                }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>

            {/* Create Market */}
            <div onClick={onCreateMarket} style={{
              padding: isTablet ? "6px 10px" : "6px 14px",
              borderRadius: 7, cursor: "pointer",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.8)",
              fontWeight: 600, fontSize: 11,
              fontFamily: "var(--mono)",
              userSelect: "none", transition: "all 0.15s", marginLeft: 4, marginRight: 6,
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.11)"; e.currentTarget.style.color = "rgba(255,255,255,0.95)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
            >
              {isTablet ? "+ Create" : "+ Create Market"}
            </div>

            <ConnectButton client={client} chain={sepolia} theme="dark"
              connectButton={{ style: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontFamily: "var(--mono)", fontSize: 11, padding: "6px 10px", borderRadius: 6 } }}
              detailsButton={{ style: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontFamily: "var(--mono)", fontSize: 11, padding: "6px 10px" } }}
            />
          </div>
        )}

        {/* Mobile nav */}
        {isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ConnectButton client={client} chain={sepolia} theme="dark"
              connectButton={{ style: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", fontFamily: "var(--mono)", fontSize: 10, padding: "5px 10px", borderRadius: 6 } }}
              detailsButton={{ style: { background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontFamily: "var(--mono)", fontSize: 10, padding: "5px 8px" } }}
            />
            <div onClick={() => setShowMobileMenu(v => !v)}
              style={{ ...ghostBtn, padding: "6px 8px", fontSize: 15, color: "rgba(255,255,255,0.5)" }}
            >
              {showMobileMenu ? "✕" : "☰"}
            </div>
          </div>
        )}
      </header>

      {/* Mobile menu */}
      {isMobile && showMobileMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 98 }} onClick={() => setShowMobileMenu(false)} />
          <div style={{
            position: "fixed", top: 52, left: 0, right: 0, zIndex: 99,
            background: "rgba(10,10,10,0.97)", backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "10px 14px 14px",
            display: "flex", flexDirection: "column", gap: 3,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              Ethereum Sepolia
            </div>

            {/* Notifications */}
            <div onClick={() => { onOpenNotifications(); setShowMobileMenu(false); }}
              style={{ padding: "10px 10px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1.5C5 1.5 3.5 3 3.5 5v3L2 9.5h10L10.5 8V5C10.5 3 9 1.5 7 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M5.5 10.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                Notifications
              </div>
              {unreadCount > 0 && (
                <span style={{ minWidth: 16, height: 16, borderRadius: 99, background: "#7c6af7", color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", padding: "0 4px" }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>

            <div onClick={() => { setShowHowItWorks(true); setShowMobileMenu(false); }}
              style={{ padding: "10px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11, color: "rgba(255,255,255,0.45)", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
            >
              How it works
            </div>

            {CONTRACTS.map(c => (
              <a key={c.addr} href={`https://sepolia.etherscan.io/address/${c.addr}`} target="_blank" rel="noreferrer"
                onClick={() => setShowMobileMenu(false)}
                style={{ display: "flex", flexDirection: "column", gap: 2, padding: "10px 10px", borderRadius: 8, textDecoration: "none", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>{c.name}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(167,139,250,0.5)" }}>{c.addr.slice(0, 14)}...{c.addr.slice(-6)} ↗</span>
              </a>
            ))}

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", margin: "4px 0" }} />

            <div onClick={() => { onCreateMarket(); setShowMobileMenu(false); }}
              style={{ padding: "11px 10px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)", fontWeight: 600, fontSize: 12, fontFamily: "var(--mono)", textAlign: "center", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.11)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
            >
              + Create Market
            </div>

            <div onClick={() => { if (!loading) { onRefresh(); setShowMobileMenu(false); } }}
              style={{ padding: "10px 10px", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontFamily: "var(--mono)", fontSize: 11, color: "rgba(255,255,255,0.35)", opacity: loading ? 0.4 : 1, textAlign: "center" }}
            >
              {loading ? "Refreshing…" : "⟳ Refresh"}
            </div>
          </div>
        </>
      )}

      {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}
    </>
  );
}