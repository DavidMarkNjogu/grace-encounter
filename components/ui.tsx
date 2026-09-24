import { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "destructive" }) {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 cursor-pointer";
  
  let styles = "";
  if (variant === "primary") {
    styles = "bg-primary text-white hover:bg-primary-2 shadow-sm";
  } else if (variant === "secondary") {
    styles = "bg-surface text-ink-900 hover:bg-surface-2 border border-line";
  } else if (variant === "destructive") {
    styles = "bg-danger-bg text-danger hover:bg-red-200";
  } else {
    // ghost
    styles = "hover:bg-surface-2 text-ink-700 hover:text-ink-900";
  }

  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`flex h-10 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm ring-offset-surface file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all ${className}`}
      {...props}
    />
  );
}

export function Card({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface-2 text-ink-900 shadow-sm ${className}`}
      {...props}
    />
  );
}

// Minimal row design for static lists
export function ListRow({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-line bg-surface/50 px-4 py-3 hover:bg-surface-2 transition-colors ${className}`}
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
