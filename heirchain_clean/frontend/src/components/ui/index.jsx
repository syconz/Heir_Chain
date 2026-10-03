// ─── Badge ────────────────────────────────────────────────────────────────
export function Badge({ children, color = "gray" }) {
  const colors = {
    gray:   "bg-dark-600 text-gray-400",
    green:  "bg-brand-900/50 text-brand-400 border border-brand-800",
    yellow: "bg-amber-900/50 text-amber-400 border border-amber-800",
    red:    "bg-red-900/50 text-red-400 border border-red-800",
    blue:   "bg-blue-900/50 text-blue-400 border border-blue-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────
export function StatusBadge({ triggered, distributed, exists }) {
  if (!exists)      return <Badge color="gray">No Will</Badge>;
  if (distributed)  return <Badge color="blue">Distributed</Badge>;
  if (triggered)    return <Badge color="yellow">Triggered — Dispute Window</Badge>;
  return              <Badge color="green">Active</Badge>;
}

// ─── Card ─────────────────────────────────────────────────────────────────
export function Card({ children, className = "" }) {
  return (
    <div className={`glass p-6 animate-fade-in ${className}`}>
      {children}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────
export function Spinner({ size = "sm" }) {
  const s = size === "sm" ? "w-4 h-4" : "w-6 h-6";
  return (
    <span className={`inline-block ${s} border-2 border-brand-500 border-t-transparent rounded-full animate-spin`} />
  );
}

// ─── CountdownTimer ───────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { secondsUntil } from "../../utils/helpers";

export function CountdownTimer({ targetTs, label = "Time remaining", onExpire }) {
  const [display, setDisplay] = useState(secondsUntil(targetTs));
  const expired = useRef(false);

  useEffect(() => {
    expired.current = false;

    const update = () => {
      const t = secondsUntil(targetTs);
      setDisplay(t);
      if (!t && onExpire && !expired.current) {
        expired.current = true;
        onExpire();
      }
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetTs, onExpire]);

  if (!display) return (
    <div className="text-brand-400 text-sm font-medium">✓ {label} elapsed</div>
  );

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-brand-400 font-mono text-lg font-semibold">{display}</span>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────
export function EmptyState({ icon = "📭", title, description, action }) {
  return (
    <div className="glass p-12 text-center flex flex-col items-center gap-4">
      <span className="text-4xl">{icon}</span>
      <div>
        <p className="text-gray-200 font-medium">{title}</p>
        {description && <p className="text-gray-500 text-sm mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold text-gray-100">{title}</h1>
      {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────────────
export function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-dark-600 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm text-gray-200 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-md p-6 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
          <button aria-label="Close dialog" onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}
