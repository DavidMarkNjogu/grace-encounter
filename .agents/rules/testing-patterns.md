---
name: Full-Stack Testing Patterns
trigger: always_on
description: Standardized testing approach for Next.js + Supabase projects.
---
# Testing Strategy
When writing tests for a full-stack Next.js + Supabase project, enforce the following separation of concerns:
1. **Database Logic (pgTAP)**: Use `pgTAP` via the Supabase CLI (`supabase test db`) for all schema-level tests, RPC behavior, RLS policies, and database constraints. Do NOT use Vitest to test database logic.
2. **App Logic (Vitest)**: Keep Vitest strictly for React components and API routes.
3. **Accessibility (A11y)**: Use `vitest-axe` with jsdom to catch accessibility violations in Client Components. Ensure required environment variables (e.g., Supabase API keys) are mocked in the `vitest.setup.ts` file to prevent components from crashing during rendering.
