"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "mnna_access_client_id";

function getClientId() {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const generated =
      (window.crypto && "randomUUID" in window.crypto && window.crypto.randomUUID())
        ? window.crypto.randomUUID().replaceAll("-", "")
        : `${Date.now()}${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(STORAGE_KEY, generated);
    return generated;
  } catch {
    return `${Date.now()}${Math.random().toString(16).slice(2)}`;
  }
}

function sendAccessHit(payload) {
  const body = JSON.stringify(payload);
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon && navigator.sendBeacon("/api/access/hit", blob)) return;
  } catch {
    // fallback below
  }
  fetch("/api/access/hit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export default function AccessTracker() {
  const pathname = usePathname();
  const lastSentPathRef = useRef("");

  useEffect(() => {
    if (!pathname) return;
    if (lastSentPathRef.current === pathname) return;
    lastSentPathRef.current = pathname;

    const clientId = getClientId();
    document.cookie = `access_client_id=${clientId}; Max-Age=31536000; Path=/; SameSite=Lax`;

    sendAccessHit({
      path: pathname,
      clientId,
      referer: document.referrer || "",
      at: new Date().toISOString(),
    });
  }, [pathname]);

  return null;
}
