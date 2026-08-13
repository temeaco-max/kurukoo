# Final built-runtime validation summary

**Runtime:** `http://127.0.0.1:3300`, rebuilt from the final `dist/` output on 2026-08-13.

| Surface | Validation outcome |
|---|---|
| Homepage request-flow panel | The rendered **One request, visible boundaries** teardown shows complete descriptions for Capture, Coordinate, Confirm, and Fulfil. Each description now sits in the full text column beside its numbered marker; it does not collapse beneath the 30px marker column. |
| Control Room shell | Dashboard, Control Plane, and SEO pages show the shared fixed sidebar, shared header, `Signals` trigger, and the standard **Kurukoo operating system / Control room** heading treatment. |
| Unauthenticated admin safety | The Control Plane and SEO console fail closed with an explicit administrator-authentication message. No controls, statistics, or secret material are exposed. |
| Responsive regression | The repeatable CDP harness exercised the homepage, login, and all 17 shared-shell Control Room destinations at 360, 390, 414, 768, 900, 1024, 1280, and 1440px (152 total checks). It recorded **0 horizontal-overflow failures**, **0 missing shared-shell failures**, and **0 non-fixed-sidebar failures**. |

The responsive harness is retained as `scripts/validate-built-responsive.mjs` for repeatable built-runtime checks.
