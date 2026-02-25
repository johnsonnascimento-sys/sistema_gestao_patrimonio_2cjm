# Prompt de Redesign UI (Referencia Visual)

## Cabecalho

| Campo | Valor |
|---|---|
| Modulo | `docs` |
| Arquivo | `docs/PROMPT_REDESIGN_UI_REFERENCIA.md` |
| Funcao no sistema | Prompt canonico para refatoracao visual frontend sem impacto funcional |
| Data | 2026-02-25 |
| Versao | v1.0 |
| Fonte de verdade (governanca) | `PROJECT_RULES.md` (v1.2.0) |

## Prompt atualizado

```text
ROLE

You are a Senior UI Architect and Frontend Refactor Engineer.

Your task is to redesign the visual appearance of this system while preserving 100% existing functionality.

PRE-FLIGHT (MANDATORY)

Before doing anything:

1) Read PROJECT_RULES.md
2) Treat PROJECT_RULES.md as source of truth
3) Follow all constraints strictly
4) If any instruction conflicts with PROJECT_RULES.md, stop and report the conflict

REFERENCE ALIGNMENT (MANDATORY)

Use the provided inspiration screenshot as visual direction.
Target high similarity in visual hierarchy and layout composition, not a literal clone.
Do not copy brand identity assets from the reference.

MISSION

Perform a VISUAL REDESIGN ONLY.
Modernize the UI into a professional institutional admin dashboard style while keeping behavior IDENTICAL.

NON-NEGOTIABLE CONSTRAINTS

You MUST NOT change:

- Backend logic
- API contracts (paths, methods, request/response fields)
- Database schema
- Controllers
- Runtime routes
- Business rules
- Authentication logic
- Compliance/legal logic

UI CONTRACT PRESERVATION (CRITICAL)

You MUST NOT remove or rename:

- IDs used by behavior
- Names used by forms/payloads
- Classes referenced by JS behavior
- data-* attributes
- Input attributes with behavior impact (e.g., accept/capture)

You MUST preserve:

- Scanner flow
- File upload flow
- Offline sync flow
- Existing form submission behavior and payload shape

ALLOWED CHANGES

You MAY:

- Add new classes
- Add wrappers/containers
- Improve JSX layout structure
- Improve spacing, typography and hierarchy
- Improve cards/tables/forms with Tailwind utilities
- Add small complementary CSS only when strictly necessary

TECH STACK CONSTRAINTS

Frontend stack:

- React
- Vite
- TailwindCSS

Rules:

- Tailwind is the primary styling system
- Avoid large custom CSS files
- No UI framework additions (MUI, Chakra, Bootstrap, etc.)

MANDATORY PROCESS

STEP A - Frontend Mapping (NO CODE)

Analyze and report:

- Main pages and app shell
- Layout components
- Current styling strategy (Tailwind vs custom CSS)
- Tables, forms, dashboard blocks
- Files responsible for layout
- Files responsible for tables
- Files responsible for forms
- JS selectors/contracts that must remain unchanged
- Regression risk hotspots

Do NOT write code yet.

STEP B - Refactor Plan

Create a 3-phase plan:

PHASE 1 - Layout Foundation
- Sidebar shell
- Topbar shell
- Main content container
- Spacing rhythm and navigation hierarchy

PHASE 2 - Design System Alignment
- Color system
- Typography scale
- Buttons, inputs, badges
- Cards and table patterns
- Hover/focus/active/disabled states

PHASE 3 - Page Refinement
- Dashboard sections
- List/table pages
- Form/detail pages
- Final consistency pass

For each phase, include:

- Files to modify
- Risks
- Mitigations
- Functional regression checks

STEP C - Implementation (INCREMENTAL)

Implement PHASE 1 only.
Do NOT implement phases 2 and 3.
After PHASE 1, stop and wait for instructions.

DESIGN TARGET (MATCH REFERENCE STYLE)

Visual DNA:

- Light institutional interface
- Clean, minimal, low-noise surfaces
- Soft purple/lilac accent
- Subtle shadows and borders

Avoid:

- Dark theme
- Heavy gradients
- Glassmorphism
- Neumorphism
- Over-animated UI

Layout blueprint:

- Sidebar fixed left, width ~220-240px
- Topbar in content area, height ~68-72px
- Main background soft neutral
- 24-32px spacing rhythm
- Dashboard composition:
  - Welcome/hero card + locations card
  - KPI mini cards row
  - Category card + recent items table card

Tailwind direction:

- App background: bg-slate-50
- Card: bg-white rounded-2xl border border-slate-200 shadow-sm p-5/p-6
- Sidebar active item: bg-violet-50 text-violet-700
- Primary button: bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-2
- Inputs: bg-white border border-slate-300 rounded-lg px-3 py-2
- Focus: focus:ring-2 focus:ring-violet-500 focus:border-violet-500
- Table head: bg-slate-100
- Row hover: hover:bg-slate-50
- Cell padding: px-4 py-3

DEFINITION OF DONE (PHASE 1)

1) All existing behavior remains identical
2) No JS selector/form contract is broken
3) No runtime errors
4) Sidebar + topbar + main layout hierarchy matches reference direction
5) Light institutional visual consistency achieved
6) Tailwind remains primary styling system
7) Desktop and mobile rendering preserved
8) No unnecessary dependencies
9) Visual parity checklist delivered with before/after screenshots

MANDATORY DELIVERABLES AFTER PHASE 1

1) Files modified
2) Files created
3) What changed visually
4) How the new layout works
5) UI contracts explicitly preserved
6) Smoke-test checklist results
7) Visual parity checklist vs reference
8) Required Wiki-First documentation updates (done/pending)

Then STOP and wait for instructions.
```

