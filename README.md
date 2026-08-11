# Kurukoo v5.41 — Everyday Utility Platform

**Tagline:** Wake up. Get going.
**Shortcode:** `*7000#` · **Voice/WhatsApp:** `7000`
**Previous working names:** Xentrix → **Kurukoo** (final)

Kurukoo is an AI-powered everyday utility platform that gives every user a single, private number to **request anything**, **offer any skill**, and **earn from it** — securely and privately, inside one conversation. It works on WhatsApp, on a basic feature phone via USSD, and through a lightweight PWA (the “Kurukoo App”).

> Kurukoo is not a chatbot. It is economic infrastructure that happens to use chat as one of its interfaces.

## Architecture

| Area | Current implementation |
|---|---|
| Composition root | `src/index.ts` performs startup and mounts canonical route boundaries. It must not regain a legacy catch-all route module. |
| HTTP boundaries | `src/routes/*` owns HTTP routes. `/health` belongs to `healthRoutes`; `/`, `/explore`, and `/p/:providerSlug` belong to `publicRoutes`; referral routes remain in `userRoutes`. |
| Services and skills | `src/services/*` owns business orchestration. `skillFlows.ts` is the canonical Economic Request skill, requirement, capability, and lifecycle catalogue. |
| Economy | A single economic lifecycle handles rides, food, repair, work, product sourcing, tickets, and artist/creator requests. Artist booking is not a privileged transaction architecture. |
| Identity | One `memory_profiles` and `skills` model; no legacy `users`, `riders`, or `providers` silos. |
| Authorization | User-owned Economic Request endpoints apply explicit `authenticateUser` middleware. Orchestration and memory-maintenance routes require explicit `authenticateAdmin` middleware. |
| Database | `sql.js` runs in-process and persists to `kurukoo.sqlite` (override with `DB_PATH`). Writes use a same-directory temporary file and atomic replacement, but the model remains single-process. |
| Rate limiting | In-memory process-local limits are appropriate only for the single-instance launch model. |
| Channels | WhatsApp webhook (`src/channels/whatsapp.ts`), USSD (`src/ussd/menus.ts`), and the PWA (`public/dashboard.html`). |
| Front end | EJS public pages (`views/`) and vanilla JavaScript PWA (`public/`). Dynamic provider, opportunity, promotion, and chat text is rendered with DOM nodes and `textContent`. |

## Quick Start

Kurukoo uses **npm 10.9.2** and commits `package-lock.json` for reproducible installs. Use Node.js 22.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run dev                 # tsx index.ts → http://localhost:3000
npm run lint                # TypeScript type-check
npm run build               # type-check + public asset copy + CSS optimization
npm run test:routes         # canonical route and ownership contracts
npm run audit:security      # static safety invariants + HTTP authorization behavior
```

When intentionally changing dependencies, use `npm install`, commit both `package.json` and `package-lock.json`, and run the validation suite before opening a pull request.

## Production transition points

The current launch architecture is intentionally cost-effective but has clear boundaries. Do not run multiple application replicas against the `sql.js` file or assume process-local rate limits coordinate across replicas. Move to PostgreSQL and Redis when high availability, concurrent multi-instance writes, distributed rate limiting/presence, or sustained marketplace-scale traffic is required.

Payment, regulated escrow, real provider/identity verification, malware-scanned object storage, and provider-console credential rotation remain external operational requirements. The application must not claim that a database record, indicative rate, sandbox payment, or profile is proof of an external financial, verification, or availability event.

## Security notes

Current CI includes build, test, custom audit, FastText, and secret-scan jobs. The current `.env.example` contains placeholders only. A historical environment-template exposure requires the repository owner to rotate affected provider credentials and review provider/GitHub audit logs; removing values from a later commit does not revoke them. See `SECURITY_AUDIT_STATUS.md` for the current status and residual risks.

## Key Docs

- `BLUEPRINT.md` — master specification.
- `BUILD_STATUS.md` — canonical route ownership and release verification status.
- `SECURITY_AUDIT_STATUS.md` — security posture, manual operator actions, and scale transition criteria.
- `ECOSYSTEM.md` — authoritative economic taxonomy.
- `CACHING.md`, `DATA_RETENTION_POLICY.md`, `POINTS_COMPLIANCE.md`, and `WHATSAPP_CONTINGENCY.md` — operating policies.

## Stack

`express` · `ejs` · `sql.js` · `mqtt` (Universal Remote/IoT) · `dotenv` · `tsx` · `typescript` (strict)
