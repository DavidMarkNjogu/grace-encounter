import { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-gradient-to-b from-gold-400 to-gold-600 text-ink-950 font-semibold hover:brightness-110 shadow-lifted ring-1 ring-gold-300/40"
      : "border border-cream-100/20 text-cream-50 hover:bg-cream-50/5 hover:border-cream-100/40";
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-cream-100/15 bg-ink-900/60 px-4 py-3 text-cream-50 placeholder:text-cream-200/70 outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/30 ${
        props.className ?? ""
      }`}
    />
  );
}

export function Card({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-cream-100/10 bg-ink-900/50 p-6 shadow-lifted backdrop-blur-sm ${className}`}
      {...props}
    />
  );
}

// Flatter, no-shadow variant for static list rows (search results) so they
// don't visually read as clickable the way action Cards do.
export function ListRow({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-cream-100/10 bg-ink-900/30 px-4 py-3 ${className}`}
      {...props}
    />
  );
}

const STATUS_LABEL: Record<string, string> = {
  not_called: "Not called",
  pending: "Pending",
  confirmed: "Confirmed",
  tentative: "Tentative",
};
const STATUS_COLOR: Record<string, string> = {
  not_called: "bg-ink-700 text-cream-100/70",
  pending: "bg-pending-500/25 text-pending-500",
  confirmed: "bg-ok-500/25 text-ok-500",
  tentative: "bg-warn-500/25 text-warn-500",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        STATUS_COLOR[status] ?? STATUS_COLOR.not_called
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
