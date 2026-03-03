import { useEffect, useState } from "react";

const ICONS = {
  success: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6.5" stroke="currentColor" strokeOpacity="0.4"/>
      <path d="M4.5 7L6.5 9L9.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  error: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6.5" stroke="currentColor" strokeOpacity="0.4"/>
      <path d="M5 5L9 9M9 5L5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6.5" stroke="currentColor" strokeOpacity="0.4"/>
      <path d="M7 6.5V10M7 4.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

const STYLES = {
  success: { color: "#ffffff", accent: "rgba(255,255,255,0.5)", dot: "#22c55e" },
  error:   { color: "#ffffff", accent: "rgba(255,255,255,0.5)", dot: "#ef4444" },
  info:    { color: "#ffffff", accent: "rgba(255,255,255,0.5)", dot: "#a1a1aa" },
};

export default function Toast({ toast }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (toast) {
      setLeaving(false);
      setVisible(true);
    } else {
      setLeaving(true);
      const t = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(t);
    }
  }, [toast]);

  if (!visible || !toast) return null;

  const s = STYLES[toast.kind] || STYLES.info;

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      zIndex: 999,
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "11px 14px",
      borderRadius: 10,
      // Vercel-style: dark solid surface, subtle border, no color bleed
      background: "#111111",
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset",
      maxWidth: 320,
      animation: leaving ? "toastOut 0.18s ease forwards" : "toastIn 0.18s ease forwards",
    }}>

      {/* Status dot — only color element */}
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: s.dot, flexShrink: 0,
        boxShadow: `0 0 6px ${s.dot}40`,
      }} />

      {/* Icon */}
      <span style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0, display: "flex", alignItems: "center" }}>
        {ICONS[toast.kind] || ICONS.info}
      </span>

      {/* Message */}
      <span style={{
        fontFamily: "var(--sans)",
        fontSize: 12,
        fontWeight: 500,
        color: "#e4e4e7",
        lineHeight: 1.4,
        letterSpacing: -0.1,
      }}>
        {toast.msg}
      </span>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translateY(0)   scale(1);    }
          to   { opacity: 0; transform: translateY(4px) scale(0.97); }
        }
      `}</style>
    </div>
  );
}