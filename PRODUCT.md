# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Mixed, general Typst users — hobbyists through academic and professional authors — who want to write and compile Typst documents without installing a toolchain. No single persona dominates; the editor must serve first-time visitors and repeat power users on the same surface.

## Product Purpose

Headspot is a zero-install, browser-based Typst editor: users write Typst source, see a live compiled preview, and manage a small multi-file project (source plus assets) entirely in the browser. Success means someone can arrive with a document to write and leave with a compiled, exported result — and, when others join, with that document co-edited in real time.

## Positioning

Browser-native editing with real-time multi-user collaboration as the headline. The Typst compiler runs client-side (WASM), so there is no server round-trip to preview, and multiple people can edit the same project simultaneously. A neighboring desktop or SaaS editor could not truthfully copy both the no-install browser workflow and live collaboration together.

## Operating Context

Browser tab or installable web app. Users work in projects made of source files (Typst) and asset files (images, fonts), tracked in the cloud with a local cache for offline use. Documents are compiled to a paged preview, exported (PDF, PNG, SVG, source), versioned through snapshots, and annotated with threaded comments.

## Capabilities and Constraints

Capabilities that must be preserved:

- CodeMirror-based Typst editor with diagnostics; Typst compiler running client-side as WASM
- Live, virtualized paged preview with zoom and source-jump navigation
- Real-time collaboration (Yjs) over Supabase realtime channels
- Authentication and cloud project storage via Supabase, with IndexedDB local cache and an offline queue
- Multi-file projects: create/rename/move/delete files and folders; asset uploads with drag-and-drop
- Export to PDF, PNG, SVG, and source archive
- Comment threads anchored to source ranges; document history snapshots with restore and diff
- Typst template gallery and TOML package metadata editing
- AI Copilot panel for Typst authoring assistance
- Reference/outline panel and templates

Technical constraints:

- Build: React 19 + TypeScript + Vite; Tailwind v4 for styling; CodeMirror 6; Supabase for auth/storage/realtime; Yjs for collaboration; IndexedDB for local persistence
- The full editor is an "Operate" surface: scanability, consistency, and native expectations outrank expression; branding lives in precise details

Terminology: project, source file, asset, compile, preview, snapshot, comment, template.

## Brand Commitments

The product name is Headspot (used in the UI as "Headspot home"). Existing identity assets and the incumbent visual interface are the current design authority. No further brand or voice commitments were confirmed.

## Evidence on Hand

No real testimonials, customer names, benchmarks, pricing, licensing claims, or press assets exist in the repository. Future work must not fabricate any of these.

## Product Principles

1. Zero friction to first compile — no install, no account required to start writing and previewing.
2. Collaboration is a first-class mode, not an add-on; shared editing must feel native to the same surface.
3. Preserve the full feature set; breadth is the product, so changes must not drop working capabilities.
4. The preview is the source of truth — compilation feedback is immediate and legible.