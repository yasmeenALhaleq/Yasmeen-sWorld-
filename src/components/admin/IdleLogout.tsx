"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WARNING_MS = 60_000;
const PING_EVERY_MS = 4 * 60_000;
const MAX_TIMER_MS = 6 * 60 * 60 * 1000; // "Remember me" sessions (days) skip the browser timer

/**
 * Signs the admin out after `idleMs` without activity. The server enforces the
 * same limit; this component makes it visible (a 60 second warning) and keeps
 * the server session alive while the admin is actually working, for example
 * writing a long product description without sending any request.
 */
export function IdleLogout({ idleMs }: { idleMs: number }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());
  const lastPing = useRef(Date.now());
  const active = idleMs <= MAX_TIMER_MS;

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/admin/session?action=logout", { method: "POST" });
    } finally {
      window.location.assign("/admin/login?timeout=1");
    }
  }, []);

  const ping = useCallback(async () => {
    lastPing.current = Date.now();
    try {
      const res = await fetch("/api/admin/session?action=ping", { method: "POST" });
      if (res.status === 401) window.location.assign("/admin/login?timeout=1");
    } catch {
      /* offline: the next ping will try again */
    }
  }, []);

  const stayIn = useCallback(() => {
    lastActivity.current = Date.now();
    setSecondsLeft(null);
    void ping();
  }, [ping]);

  useEffect(() => {
    if (!active) return;
    const mark = () => {
      // While the warning is showing, only the button counts as activity.
      if (Date.now() - lastActivity.current < idleMs - WARNING_MS) lastActivity.current = Date.now();
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));

    const timer = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= idleMs) {
        void signOut();
      } else if (idle >= idleMs - WARNING_MS) {
        setSecondsLeft(Math.ceil((idleMs - idle) / 1000));
      } else {
        setSecondsLeft(null);
        // Keep the server session alive while the admin is working.
        if (Date.now() - lastPing.current >= PING_EVERY_MS && idle < PING_EVERY_MS) void ping();
      }
    }, 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      window.clearInterval(timer);
    };
  }, [active, idleMs, ping, signOut]);

  if (!active || secondsLeft === null) return null;
  return (
    <div role="alertdialog" aria-live="assertive" aria-label="Inactivity warning" className="no-print fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md">
      <div className="card card-pad flex flex-wrap items-center justify-between gap-3 border-amber-400 bg-amber-50">
        <p className="text-sm font-semibold">You will be signed out in {secondsLeft}s because of inactivity.</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={stayIn} autoFocus>
          Stay signed in
        </button>
      </div>
    </div>
  );
}
