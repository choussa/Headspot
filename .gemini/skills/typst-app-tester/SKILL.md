---
name: typst-app-tester
description: Comprehensive testing protocol for the Typst SaaS MVP. Use this skill to rigorously verify the React, Supabase, and WASM compiler integration.
---

# Typst SaaS Testing Protocol

When the user asks you to "test the app" or verify its stability, follow this checklist systematically. Do not skip steps. Report your findings to the user after completing the protocol.

## Phase 1: Static & Build Verification
1. **TypeScript Build:** Run `npm run build`. Verify there are no missing imports, type mismatches, or bundle size explosions.
2. **WASM Headers Check:** Inspect `vite.config.ts` (if it exists) or production config (`vercel.json` / `public/_headers`). The app **will fatally crash** in production if `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` are missing.

## Phase 2: Backend & Database Check
Create a temporary Node script (e.g., `test_db_connection.cjs`) using `@supabase/supabase-js` and the local `.env` file to verify:
1. **Connectivity:** Can we reach the Supabase instance?
2. **Schema Integrity:** Do the tables `projects`, `project_files`, and `folders` exist? 
3. **RLS Verification:** Does an unauthenticated request to `public.projects` correctly return `[]` (or throw an Auth error) instead of leaking data?

## Phase 3: Component & Architecture Audit
Read the core files and ensure these critical flows remain intact:
1. **Storage Layer (`src/storage/cloudStore.ts`):** Check that `saveProject` upserts both project metadata (including the `thumbnail`) and the array of `project_files`.
2. **Router (`src/App.tsx`):** Ensure the session guard correctly redirects unauthenticated users to `<Auth />` and allows access to `<Dashboard />`.
3. **Compiler (`src/pages/EditorPage.tsx`):** Ensure `project.init()` is called with fonts, and `runCompile` correctly updates the `thumbnail` in the `ProjectRecord`.

## Phase 4: Live E2E Testing (If Chrome DevTools MCP is enabled)
If you have access to the `chrome-devtools` skill, perform a live UI test:
1. Start the server: `npm run dev -- --host` (send to background).
2. Connect the browser and navigate to `http://localhost:5173`.
3. Verify the Login screen renders.
4. If testing credentials are provided, log in, click "Empty document", and verify the WASM compiler initializes without `SharedArrayBuffer` errors in the console.

## Reporting
Generate a markdown artifact summarizing:
- ✅ **Passes:** What works perfectly.
- ⚠️ **Warnings:** Potential edge cases (e.g., race conditions in auto-saving).
- ❌ **Failures:** Any broken code or missing database policies.
