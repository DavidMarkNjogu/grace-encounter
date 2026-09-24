import re

with open('components/ui.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

new_colors = '''const STATUS_COLOR: Record<string, string> = {
  not_called: "bg-surface-3 text-ink-soft border border-line",
  pending: "bg-primary-soft text-primary-3 border border-primary-soft-2",
  confirmed: "bg-good-bg text-good border border-good/20",
  tentative: "bg-warn-bg text-warn border border-warn/20",
};'''

code = re.sub(r'const STATUS_COLOR: Record<string, string> = \{.*?\};', new_colors, code, flags=re.DOTALL)

with open('components/ui.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
