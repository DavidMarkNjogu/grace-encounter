import { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "destructive" }) {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-ink-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2";
  
  let styles = "";
  if (variant === "primary") {
    styles = "bg-white text-ink-950 hover:bg-zinc-200";
  } else if (variant === "secondary") {
    styles = "bg-ink-800 text-cream-50 hover:bg-ink-700 border border-ink-700";
  } else if (variant === "destructive") {
    styles = "bg-red-500/10 text-red-500 hover:bg-red-500/20";
  } else {
    // ghost
    styles = "hover:bg-ink-800 hover:text-cream-50 text-cream-100";
  }

  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`flex h-10 w-full rounded-md border border-ink-800 bg-ink-950 px-3 py-2 text-sm ring-offset-ink-950 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-cream-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all ${className}`}
      {...props}
    />
  );
}

export function Card({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-ink-800 bg-ink-900 text-cream-50 shadow-sm ${className}`}
      {...props}
    />
  );
}

// Minimal row design for static lists
export function ListRow({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-ink-800 bg-ink-950/50 px-4 py-3 hover:bg-ink-800/50 transition-colors ${className}`}
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
  not_called: "bg-surface-3 text-ink-soft border border-line",
  pending: "bg-primary-soft text-primary-3 border border-primary-soft-2",
  confirmed: "bg-good-bg text-good border border-good/20",
  tentative: "bg-warn-bg text-warn border border-warn/20",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
        STATUS_COLOR[status] ?? STATUS_COLOR.not_called
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
