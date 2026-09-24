import sys

css_content = """@import "tailwindcss";

@theme {
  /* Slate / Blue Ink for text */
  --color-ink-950: #020617;
  --color-ink-900: #0f172a;
  --color-ink-800: #1e293b;
  --color-ink-700: #334155;
  --color-ink-600: #475569;
  --color-ink-soft: #64748b;
  --color-muted: #94a3b8;

  /* Backgrounds: NO PURE WHITE. Soft, muted slate/ice tones */
  --color-bg: #e2e8f0;       /* Outer background: Muted slate */
  --color-bg-2: #cbd5e1;     /* Slightly darker for contrast */
  --color-surface: #f1f5f9;  /* Cards/Tables: Soft slate/ice (NO #ffffff) */
  --color-surface-2: #e2e8f0;
  --color-surface-3: #cbd5e1;

  /* Borders */
  --color-line: #cbd5e1;
  --color-line-strong: #94a3b8;

  /* Primary Accent: Cobalt Blue */
  --color-primary: #2563eb;
  --color-primary-2: #1d4ed8;
  --color-primary-3: #1e40af;
  --color-primary-soft: #dbeafe;
  --color-primary-soft-2: #bfdbfe;

  /* Semantic Status Colors (Mapped to soft backgrounds) */
  --color-good: #059669;
  --color-good-bg: #d1fae5;
  --color-warn: #d97706;
  --color-warn-bg: #fef3c7;
  --color-danger: #dc2626;
  --color-danger-bg: #fee2e2;

  /* High-end SaaS Shadows */
  --shadow-xs: 0 1px 2px 0 rgba(15, 23, 42, 0.05);
  --shadow-sm: 0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.05);
  --shadow-lg: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05);

  /* Generous Radii */
  --radius-xs: 6px;
  --radius-sm: 10px;
  --radius: 14px;
  --radius-lg: 20px;
  --radius-xl: 28px;
}

@layer base {
  * {
    box-sizing: border-box;
  }

  html {
    min-height: 100%;
    scroll-behavior: smooth;
  }

  body {
    background-color: var(--color-bg);
    color: var(--color-ink-900);
    /* Subtle premium background gradient simulating depth, using soft blue tints */
    background-image: 
      radial-gradient(circle at top right, rgba(37, 99, 235, 0.05), transparent 500px),
      radial-gradient(circle at bottom left, rgba(15, 23, 42, 0.03), transparent 500px);
    background-attachment: fixed;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
}
"""

with open('app/globals.css', 'w', encoding='utf-8') as f:
    f.write(css_content)

print("Updated globals.css to remove pure white")
