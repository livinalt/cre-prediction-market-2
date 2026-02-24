// src/lib/useNotifications.js
// Persistent notification system using localStorage
// No backend required — works across page refreshes

import { useState, useCallback } from "react";

const STORAGE_KEY = "foresight_notifications";
const MAX_NOTIFICATIONS = 50;

function loadFromStorage(addr) {
  try {
    const key = addr ? `${STORAGE_KEY}_${addr.toLowerCase()}` : STORAGE_KEY;
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch { return []; }
}

function saveToStorage(notifications, addr) {
  try {
    const key = addr ? `${STORAGE_KEY}_${addr.toLowerCase()}` : STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch {}
}

export function useNotifications(addr) {
  const [notifications, setNotifications] = useState(() => loadFromStorage(addr));

  const addNotification = useCallback((notification) => {
    const n = {
      id:        Date.now() + Math.random(),
      timestamp: Date.now(),
      read:      false,
      ...notification,
    };
    setNotifications(prev => {
      const updated = [n, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveToStorage(updated, addr);
      return updated;
    });
  }, [addr]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveToStorage(updated, addr);
      return updated;
    });
  }, [addr]);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveToStorage([], addr);
  }, [addr]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, addNotification, markAllRead, clearAll, unreadCount };
}

// Notification factory helpers
export const notify = {
  marketCreated: (id, question) => ({
    type:    "created",
    icon:    "✦",
    title:   `Market #${id} created`,
    detail:  question?.slice(0, 60) + (question?.length > 60 ? "…" : ""),
    color:   "#a78bfa",
  }),
  predicted: (id, side, amount) => ({
    type:    "predicted",
    icon:    "◎",
    title:   `Predicted ${side === 0 ? "YES" : "NO"} on Market #${id}`,
    detail:  `${(Number(amount) / 1e18).toFixed(4)} ETH staked`,
    color:   side === 0 ? "#22c55e" : "#ef4444",
  }),
  won: (id, question) => ({
    type:    "won",
    icon:    "🏆",
    title:   `You won on Market #${id}!`,
    detail:  question?.slice(0, 60) + (question?.length > 60 ? "…" : ""),
    color:   "#22d3a5",
    action:  "claim",
    marketId: id,
  }),
  lost: (id, question) => ({
    type:    "lost",
    icon:    "◌",
    title:   `Market #${id} resolved`,
    detail:  question?.slice(0, 60) + (question?.length > 60 ? "…" : ""),
    color:   "#6b7280",
  }),
  claimed: (id, amount) => ({
    type:    "claimed",
    icon:    "💰",
    title:   `Claimed ${(Number(amount) / 1e18).toFixed(4)} ETH`,
    detail:  `From Market #${id}`,
    color:   "#fbbf24",
  }),
  settled: (id, question) => ({
    type:    "settled",
    icon:    "⚡",
    title:   `Settlement requested on Market #${id}`,
    detail:  question?.slice(0, 60) + (question?.length > 60 ? "…" : ""),
    color:   "#fbbf24",
  }),
};