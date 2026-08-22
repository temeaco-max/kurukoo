# Kurukoo Chat — Screen Convergence Phase 2 Gap List

**Baseline:** `510e8705e61ffd42c4c382c34e4ef0d254150149`
**Scope:** `/chat` only. Desk and the other canonical screens are frozen for this phase.
**Reference authorities:** `CHAT_SURFACE_CONTRACT.md`, `docs/design/visual-system-screen-set-audit-2026-08-18.md`, `src/services/canonicalAuthenticatedScreenSetManifest.json`, `public/chat/index.html`, `public/js/kurukoo-primary-chat.js`, `public/css/kurukoo-chat.css`.

## Ownership trace

- Route: `/chat` → `src/routes/appSurfaceRoutes.ts` → `public/chat/index.html`
- Conversation runtime: `public/js/kurukoo-primary-chat.js` and its existing canonical Chat service/runtime imports
- Composer: `public/chat/index.html::composer` + existing Chat runtime
- Header: `public/chat/index.html::chat-header`
- Sidebar/history: `public/chat/index.html::chat-sidebar`, `.history-list`, existing Chat runtime
- Inspector: `public/chat/index.html::chat-inspector`, existing context/surface runtime
- Agent Presence: existing Chat presence elements/runtime; no new state machine
- Styling: `public/css/kurukoo-chat.css` + existing shared final OS authority
- Voice: existing browser speech/realtime provider boundaries
- Attachments: existing `#file-input`, attachment preview and Chat runtime
- Conversation persistence: existing canonical `conversationWorkspace`/Chat persistence owner

## Gap classification

| Area | Classification | Owner | Finding / decision |
|---|---|---|---|
| Three-region composition | CORRECT | `public/chat/index.html` | Canonical sidebar + conversation + inspector structure already exists. |
| Agent identity | CORRECT | Chat template/runtime | `/chat` is explicitly headed `Agent`; no separate Agent screen is required. |
| Conversation history | CORRECT | Chat template/runtime | Recent conversation list and selected state are present; no second store exists. |
| Context inspector | CORRECT | Chat template/runtime | Context rail and `data-context-card` surface routing already exist. |
| Composer ownership | CORRECT | Chat template/runtime | One canonical composer with text, attachment, voice, send and stop controls. |
| Voice boundary | CORRECT | Existing Chat runtime | Browser speech and explicit realtime voice remain separate provider boundaries. |
| Agent Presence owner | CORRECT | Existing Chat presence runtime | Presence vocabulary is already represented; no second state machine is needed. |
| Message actions | INCONSISTENT | `kurukoo-chat.css` + existing message runtime | Message-action buttons are currently 32px high, below the established 44px interaction contract. |
| Header icon controls | INCONSISTENT | `kurukoo-chat.css` | `.icon-btn` is 40×40 and points is 40px minimum; converge Chat controls to 44px. |
| Quick actions | INCONSISTENT | `kurukoo-chat.css` | Quick-action pills use a 40px minimum; increase to 44px for touch/keyboard consistency. |
| Composer controls | INCONSISTENT | `kurukoo-chat.css` | Attachment/voice/send controls are 40×40; increase to 44×44 without changing composer ownership. |
| History items | INCONSISTENT | `kurukoo-chat.css` | History buttons use 40px minimum; increase to 44px. |
| Mobile sidebar | CORRECT | Existing Chat responsive CSS/runtime | Existing single mobile drawer architecture is preserved. |
| Loading/streaming | CORRECT | Existing Chat runtime | Activity/streaming states are already part of the canonical turn lifecycle. |
| Empty/welcome state | CORRECT | `public/chat/index.html` | Canonical welcome state and quick actions are present. |
| Error/unavailable states | CORRECT | Existing Chat runtime | Existing provider/runtime fallbacks remain evidence-gated. |
| Product completeness | CORRECT | Canonical Chat/runtime/service owners | No capability is removed to match a visual reference. |
| Global tokens | CORRECT | Shared OS + Chat-local aliases | No new design system or shared token authority is required. |

## Implementation boundary

Only `public/css/kurukoo-chat.css` and the focused Chat regression contract may change in this phase unless a source-proven Chat-only defect requires a second Chat-owned file. No Desk, Requests, Tasks, Notifications, Contacts, Memory, Agents directory or Discover files are to be changed.

The implementation is limited to interaction-geometry convergence and source-level Chat contract hardening. Runtime/browser verification remains separate and must not be inferred from static checks.
