"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  isSessionExpired,
  subscribeSessionExpired,
} from "@/lib/sessionExpiry";

export function SessionExpiredModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isSessionExpired()) setOpen(true);
    const unsub = subscribeSessionExpired(() => setOpen(true));
    return unsub;
  }, []);

  // Kunci scroll + blok tombol Escape selama modal tampil (tidak bisa ditutup).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  function handleRelogin() {
    // Sama seperti Sign Out: bersihkan token/sesi lalu arahkan ke halaman login.
    try {
      document.cookie = "Authorization=; path=/; max-age=0";
      window.sessionStorage.clear();
      window.localStorage.removeItem("Authorization");
    } catch {
      // ignore
    }
    window.location.replace("/login");
  }

  return (
    <div
      style={S.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
    >
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.icon}>🔒</div>
        <div id="session-expired-title" style={S.title}>
          Sesi Anda telah berakhir
        </div>
        <div style={S.desc}>
          Sesi login Anda sudah habis demi keamanan. Silakan login kembali untuk
          melanjutkan.
        </div>
        <button type="button" style={S.btn} onClick={handleRelogin}>
          Login kembali
        </button>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 380,
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    padding: 24,
    textAlign: "center",
  },
  icon: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 },
  desc: { fontSize: 14, color: "#475569", lineHeight: 1.5, marginBottom: 20 },
  btn: {
    width: "100%",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 16px",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
  },
};
