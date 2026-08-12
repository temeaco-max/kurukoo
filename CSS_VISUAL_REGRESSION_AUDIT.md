# CSS and Public Visual Regression Audit

## Scope

The audit covered 13 production CSS files, all public EJS templates, client-side JavaScript, and 16 public routes at 360px and 1440px widths. The route matrix produced 32 screenshots.

## CSS findings

The production CSS audit reported no exact duplicate top-level blocks, no duplicate core design tokens, no inline styles in server-rendered templates, and no inline event handlers. The detailed site stylesheet still contains 23 repeated selectors and 85 repeated declaration bodies; most are intentional cascade/state variants or legacy multi-surface rules rather than exact duplicate blocks.

The class-usage inventory initially produced many candidates because classes can be created dynamically and because CSS contains authenticated, admin, chat, workspace, and legacy compatibility surfaces not represented in public templates. Manual review identified four high-confidence dead legacy groups left by the public heading migration: `.explore-body`, `.explore-header-section`, `.explore-badge`, `.explore-h1`, `.explore-subtitle`, `.explore-search-btn`, `.help-hero`, `.help-title`, and `.blog-hero-desc`. These were removed. Selectors still referenced by templates or dynamic controls, including `.help-badge`, `.api-hero-desc`, `.contact-title`, `.explore-search-container`, and `.explore-search-input`, were retained.

## Visual regression findings

All 16 public routes returned successful HTTP responses. Redirecting routes such as `/advertise`, `/discover`, `/partners`, and `/resources` returned expected `301` responses and rendered successfully through the screenshot URL. All 32 screenshots were generated from the fresh compiled runtime.

The desktop contact sheet showed consistent page-container alignment, expected centered public headings, preserved specialized layouts for Discover’s map, Explore’s category cards, Partners’ grid, Resources’ tables, and Legal’s content. The mobile contact sheet showed no horizontal overflow or clipped page-shell content. Public pages retain their intentional hero variants where applicable; the shared container migration did not collapse their content margins or alter their page-specific card grids.

## Routes checked

`/`, `/about`, `/advertise`, `/blog`, `/careers`, `/channels`, `/contact`, `/discover`, `/explore`, `/help`, `/how-it-works`, `/legal/privacy`, `/network`, `/partners`, `/pricing`, and `/resources`.

## Generated evidence

Fresh screenshots are stored temporarily under `/tmp/kurukoo-visual-regression/`, with desktop and mobile contact sheets at `contact-sheet-1440.png` and `contact-sheet-360.png`.
