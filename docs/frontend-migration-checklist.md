# :3000 → Frontend Migration Checklist

Canonical map of every page the Express backend renders (EJS) and its status in
the React frontend (`frontend/`, TanStack Start). Page content is exposed to the
frontend through `/api/content/*` (see `src/routes/pageContentRoutes.ts`) plus
existing domain APIs, so both surfaces share one source of truth.

Legend: ✅ exists and wired · 🟡 page exists, content still prototype/demo · ❌ missing in frontend

## Public marketing / content pages
| Backend page | Content source | Frontend route | Status |
| --- | --- | --- | --- |
| `/` home (country experience ng/gh/gb, homepage ads) | `views/index.ejs`, `/api/content/home` | `/` | 🟡 wire SEO/country content |
| `/about` | `views/about.ejs`, `/api/content/page` | `/about` | 🟡 |
| `/pricing` | `views/pricing.ejs` | `/pricing` | 🟡 |
| `/how-it-works` | `views/how-it-works.ejs` | `/how-it-works` | 🟡 |
| `/help` | `views/help.ejs` | `/help` | 🟡 |
| `/legal/:section` | `views/legal.ejs` | `/legal`, `/legal/$section` | 🟡 |
| `/blog` | `views/blog.ejs` | `/blog` | 🟡 |
| `/careers` | `views/careers.ejs` | `/careers` | ✅ created from canonical copy |
| `/channels` (live readiness) | `views/channels.ejs`, `/api/content/channels` | `/connect` (authenticated) | ✅ live states rendered in the signed-in Connect page via `ChannelActivationStates`; `/channels` redirects to `/connect` |
| `/api-docs` | `views/api_docs.ejs` | `/api-docs` | ✅ created from canonical copy |
| `/contact` | `views/contact.ejs` | `/contact` | 🟡 |
| `/partners` | `views/partners.ejs` | `/partners` | 🟡 |
| `/advertise` | `views/advertise.ejs` | `/advertise` | 🟡 |
| `/network` | `views/network.ejs` | `/network` | 🟡 |
| `/help` + `/help/guides/:slug` | `/api/content/resources` + `/api/content/resources/:slug` | `/help` (help areas, guides, ideas) + `/help/guides/$slug` (detail) | ✅ `/resources` retired as a page and 302s to `/help`; guides render from the SPA owner chain |
| `/discover` | `views/discover.ejs` | `/discover` | 🟡 |
| `/features`, `/developers`, `/developers/api` | `views/features.ejs`, `views/developers.ejs` | `/developer` | 🟡 consolidate |
RETIRED | `/p/:providerSlug` public provider profile (page removed; JSON API `/api/content/providers/:slug` | `/profile/$slug` | 🟡 wire to API |
| `/earn/:topic`, `/earn/rides` | redirect map, `/api/content/earn-map` | `/earn/$topic` | ✅ redirect implemented |
| `/events` | redirect → `/discover/events` | `/discover/events` | ✅ |
| `/discover`, `/discover/:slug` | `views/discover/category.ejs` | `/discover` + `routes/discover/<slug>.tsx` | ✅ single spine |
| `/topics`, `/topics/:slug` | `views/topics/*`, `/api/topics` | `/topics`, `/topics/$slug` | ✅ wired via kurukoo-api |
| `/login` (OTP) | `views/login.ejs`, `/api/auth/*` | `/login` | ✅ wired via kurukoo-auth |
| `/whatsapp-linked-device`, `auth-challenge-complete` | device-link flow | — | ❌ niche flow, defer |
| `/admin`, `/admin/login` | separate static admin console | — | ❌ out of scope (admin) |

## Authenticated app shell (`app.ejs` surfaces)
Workspace surfaces (chat, activity, work, settings, provider workspace) are
served by `views/app.ejs`; the frontend equivalents are `/chat`, `/activity`,
`/work`, `/you`, `/settings`, `/wallet`, `/messages`, `/notifications`. These
already speak to the same APIs (`/api/v1/chat/*`, `/api/agent/*`,
`/api/memory/*`, `/api/economic-requests/*`). Remaining work is verifying each
surface against the EJS shell feature by feature.

## Retirement rule
Once a frontend page shows the canonical content above, the backend EJS route
for that page becomes a redirect to the frontend. EJS views are removed only
after their redirect replacements are verified in production.
