# Project Inspection & Design Baseline

## 1. Actual Framework
- **Stack:** Next.js 14 (App Router) + React 18 + Supabase
- **Build Tool:** pnpm, Vite (for testing)

## 2. Existing Components
- Custom UI components (Card, Input, Button) located in components/ui.tsx.
- Radix UI or shadcn-like headless primitives (if applicable, though current components seem mostly custom Tailwind wrappers).

## 3. Routing
- Next.js App Router (pp/)
- Public routes: /
- Protected/Admin routes: /admin, /admin/login
- Auth routes: /auth/callback

## 4. Styling Architecture
- **CSS Framework:** Tailwind CSS 4.x
- **Theme Variables:** Custom defined in pp/globals.css with a very distinct palette (--ink-950 to --ink-800 for dark backgrounds, --cream-50 to --cream-200 for text, --gold-300 to --gold-500 for accents).
- **Current Vibe:** Dark mode, high contrast, bespoke event theme.

## 5. Current Screens
- **Registration Desk (Admin):** Main view for managing registrants. Just transitioned from a messy "flex list" to a structured Data Table.
- **Login:** Simple auth screen.

## 6. Where the UI is Actually Going Wrong (Gap Analysis)
- **Lack of Component Standardization:** Prior iterations used raw div tags with massive inline Tailwind strings rather than composing reusable design tokens.
- **Visual Hierarchy:** Forms and inputs were blending into the background. The transition to the data table helped, but the overall "app shell" (navigation, header) still lacks a premium SaaS structure.
- **Feedback:** "Trash" UI feeling came from insufficient padding, borders that lacked contrast, and interactive elements (buttons/selects) that didn't provide immediate visual feedback (hover/focus states).

## 7. What Should Remain Untouched
- The **Supabase backend logic** and **Database schema** (Registrants, Duplicate logic).
- The newly implemented **robust parsing engine** (line-by-line regex).

## Next Steps for the Design Partner
We will use this .design/ directory to store reference breakdowns, UX benchmarks, and our component system specifications as we iteratively improve the app.
