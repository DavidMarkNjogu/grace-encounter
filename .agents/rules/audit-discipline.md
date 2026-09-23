---
name: Audit & Architect Discipline
trigger: always_on
description: Mandatory pre-flight checklist for punch-lists and bug fixes.
---
# Mandatory Punch-list Protocol
When handed a punch-list or bug list, never jump straight to coding. You MUST:
1. **Force a mandatory Audit & Architect phase**: Check the holistic system surrounding the bugs. Do not treat the list as exhaustive. (e.g., if touching an Admin Dashboard, verify basic CRUD exists).
2. **Explicitly Verify Database Constraints**: When altering Postgres schemas (especially RPC signatures), always explicitly check for side-effects such as missing `GRANT EXECUTE` statements or broken Foreign Key cascades.
3. **Verify Locally**: Do not assume SQL syntax is correct just because it looks right.
