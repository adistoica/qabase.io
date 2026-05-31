# Handoff: QABase Marketing Landing Page

## Overview
This is the design for **QABase's primary marketing landing page** — a single long-scroll page positioning QABase as a test intelligence platform for engineering teams. The page is structured around a hero pitch, a problem/solution argument, three product features, integrations, customer evidence, a feature grid, a CTA, FAQs, and a newsletter signup. It is intended as the `/` route of the marketing site.

## About the Design Files
The file in this bundle (`QABase Landing.html`) is a **design reference created in HTML** — a high-fidelity prototype showing intended look, layout, copy, and interaction. **It is not production code to ship directly.**

The task is to **recreate this design in the target codebase's existing environment** (e.g. Next.js + Tailwind, Astro + CSS modules, Nuxt, SvelteKit, etc.) using its established patterns, component primitives, design tokens, and routing. If no marketing-site codebase exists yet, Next.js (App Router) + Tailwind CSS is a reasonable default for a static/ISR marketing page like this.

Treat the HTML/CSS as the visual spec, not the implementation. Componentize sections, lift colors/typography into your design tokens, and replace ad‑hoc CSS with whatever your codebase already uses.

## Fidelity
**High-fidelity (hifi).** Final colors, type scale, spacing, copy, and component composition are all finalized. Recreate pixel‑accurately, then map values onto the codebase's design tokens.

## Page Structure
Top → bottom:

1. Announcement bar (dark)
2. Sticky nav
3. Hero (headline, lede, CTAs, dashboard mockup, trust strip, customer logos)
4. "The Gap" — section heading + Without/With QABase comparison
5. Quote (pull quote, attribution)
6. Three alternating feature blocks
7. Integrations (dark section with 16-tile grid)
8. Studies — 4 stat tiles + 1 featured case study card
9. Features grid (8 tiles with icons)
10. Bottom CTA (dark, with mini dashboard visual)
11. FAQs (accordion)
12. Newsletter signup
13. Footer (5 columns + bottom bar + giant wordmark watermark)

---

## Design Tokens

### Colors (OKLCH, with sRGB hex approximations)
| Token | OKLCH | Approx hex | Usage |
|---|---|---|---|
| `--bg` | `oklch(0.985 0.004 85)` | `#FAFAF7` | Page background (warm off‑white) |
| `--bg-tint` | `oklch(0.965 0.018 180)` | `#EAF3F2` | Section background tint (light teal) |
| `--bg-tint-2` | `oklch(0.955 0.025 180)` | `#E2EFEE` | Stronger tint variant |
| `--ink` | `oklch(0.19 0.025 220)` | `#1A2230` | Primary text |
| `--ink-soft` | `oklch(0.32 0.02 220)` | `#3D4858` | Secondary text |
| `--muted` | `oklch(0.52 0.012 220)` | `#737B85` | Muted/meta text |
| `--line` | `oklch(0.9 0.01 200)` | `#DDE3E5` | Hairlines |
| `--line-strong` | `oklch(0.82 0.012 200)` | `#C5CDD0` | Strong borders |
| `--accent` | `oklch(0.58 0.13 188)` | `#1F8C92` | Primary accent (teal) |
| `--accent-deep` | `oklch(0.42 0.1 195)` | `#155F66` | Accent — deep teal (links, emphasis) |
| `--accent-soft` | `oklch(0.93 0.04 188)` | `#D6ECEC` | Accent — soft tint (badges, icon bg) |
| `--warn` | `oklch(0.62 0.14 35)` | `#C56A3F` | Warn / fail state |
| `--good` | `oklch(0.62 0.13 155)` | `#3C9C72` | Success / pass state |
| `--dark` | `oklch(0.18 0.02 220)` | `#15202B` | Dark sections (announce, integrations, CTA) |
| `--dark-2` | `oklch(0.22 0.022 220)` | `#1C2734` | Dark surface 2 |
| `--dark-3` | `oklch(0.28 0.022 220)` | `#293643` | Dark surface 3 |
| `--on-dark` | `oklch(0.95 0.005 220)` | `#EEF0F2` | Text on dark |
| `--on-dark-soft` | `oklch(0.72 0.012 220)` | `#A6ADB5` | Muted text on dark |

Status chip colors (used in dashboard mockup):
- Pass: `oklch(0.78 0.13 155)` on `oklch(0.62 0.13 155 / 0.18)`
- Fail: `oklch(0.78 0.14 30)` on `oklch(0.62 0.14 30 / 0.18)`
- Flaky: `oklch(0.85 0.14 75)` on `oklch(0.72 0.14 70 / 0.18)`
- Skip: `oklch(0.7 0.012 220)` on `oklch(0.5 0.02 220 / 0.3)`

### Typography
Three Google Fonts:
- **Geist** (300, 400, 500, 600, 700) — UI, body, headings
- **Geist Mono** (400, 500) — labels, eyebrows, code, meta
- **Fraunces** (400, 500, opsz 9–144) — italicized emphasis in section headings & hero

Scale (clamp() for fluid sizing — see HTML for exact clamps):
| Use | Size | Weight | Letter‑spacing | Line‑height |
|---|---|---|---|---|
| H1 (hero) | clamp(40px, 5.6vw, 68px) | 500 | -0.025em | 1.04 |
| H2 (section) | clamp(30px, 3.8vw, 46px) | 500 | -0.02em | 1.1 |
| H3 (feature) | clamp(26px, 2.8vw, 34px) | 500 | -0.02em | 1.12 |
| CTA H2 | clamp(34px, 4vw, 50px) | 500 | -0.025em | 1.05 |
| Body lede | 18px | 400 | — | 1.55 |
| Body | 16px | 400 | — | 1.55 |
| Small / meta | 13–14.5px | 400/500 | — | 1.5–1.6 |
| Eyebrow (mono) | 12px | 500 | 0.14em uppercase | — |
| Tag/pill (mono) | 11px | 500 | 0.1em uppercase | — |

### Spacing
- Container max‑width: **1180px**, side padding **28px**.
- Section vertical padding: **96px** top/bottom (standard sections), **80px** (CTA), **56px** (newsletter, hero bottom), **88px 0 56px** (hero top).
- Section head bottom margin: **56px** standard, **40px** on grids with eyebrow-only.
- Card padding: **22–32px** depending on density.
- Grid gaps: **14–16px** for tile grids, **32–56px** for layout grids.

### Radii & Shadows
- **Radius:** 8px (buttons, small chips), 10px (form fields, inner cards), 12px (dashboard inner panels), 14px (tiles, feature cards), 18px (hero/feature/large compare cards).
- **Shadows:**
  - Card lift: `0 1px 0 oklch(1 0 0) inset, 0 12px 32px -16px oklch(0 0 0 / 0.08)`
  - Dashboard float: `0 1px 0 oklch(1 0 0 / 0.06) inset, 0 30px 60px -20px oklch(0.18 0.05 200 / 0.35), 0 10px 30px -10px oklch(0 0 0 / 0.25)`
  - CTA mini chart: `0 30px 60px -20px oklch(0 0 0 / 0.4)`

### Breakpoints
Single mobile breakpoint at **`max-width: 980px`**:
- Nav links hide (replace with hamburger in production)
- Dashboard sidebar + right rail hide
- Compare table becomes single column (drop arrow)
- Feature alternation collapses (visual always under copy)
- Studies grid → 2 cols, features grid → 2 cols, integrations grid → 4 cols
- CTA, newsletter, footer collapse to single column

Below ~640px (not yet handled — please add): collapse studies/features grids to 1 column.

---

## Screen-by-screen Spec

### 1. Announcement Bar
- **Background:** `--dark`, white text, **10px 16px** padding, full width, center‑aligned flex row, **10px** gap.
- **Pill:** `oklch(0.58 0.13 188 / 0.18)` bg, `oklch(0.78 0.13 188)` text, mono 11px, uppercase, `0.1em` tracking, `999px` radius.
- **Link:** dashed underline in `oklch(0.6 0.1 188 / 0.6)`, color `oklch(0.82 0.12 188)`.
- **Copy:** `[Live] Webinar — "Why your CI dashboard isn't the source of truth"   June 12 · register →`

### 2. Nav
- Sticky (`top: 0`, `z-index: 50`), backdrop blur 12px over `--bg` at 82% alpha, **1px bottom border** in `--line`.
- Inner: **64px** height, **28px** gap, container max-width.
- **Logo:** `<logo-mark><span>QABase</span>` — 26×26 px mark (gradient `--accent` → `--accent-deep`, 7px radius, white inset "Q‑like" decoration via `::before` + `::after`). Font: Geist 600, 18px, `-0.01em`.
- **Nav links:** 14.5px Geist 400, `--ink-soft`, **8px 12px** padding, hover → tinted bg + `--ink`. Items: Platform ▾, Solutions ▾, Resources ▾, Customers, Pricing, Docs.
- **CTA cluster (right):** Sign in (`btn-ghost`), Book a demo (`btn-outline`), Start free (`btn-primary`).

### 3. Hero
- Background: radial gradient ellipse top‑center of `--accent-soft` at 60% alpha fading to transparent, over a 56×56px grid (`oklch(0.85 0.02 200 / 0.18)` lines), masked with a radial ellipse to fade outward.
- **Hero badge:** rounded pill, white bg, 1px border `--line`, inner tag chip "v4.2" in accent-soft. Copy: `Introducing the QABase MCP server →`.
- **H1:** `Shipping velocity meets release quality.` — last 2 words wrapped in `<em>` styled as Fraunces serif italic-feel (font is not italicized — Fraunces is used roman) in `--accent-deep`.
- **Lede:** max 56ch, 18px, `--ink-soft`. See HTML for exact copy.
- **CTAs:** Start free (`btn-accent btn-lg`), Book a demo (`btn-outline btn-lg`).
- **Meta line below:** mono 12px `FREE FOR TEAMS UP TO 5 · NO CREDIT CARD`.
- **Dashboard visual:** see below — sits 24px below CTAs, max 1100px wide, 20px side padding.
- **Trust strip (below dashboard, 56px gap):** `Trusted by 2,400+ engineering teams | ★★★★★ 4.8 on G2` then a wordmark row (8 placeholder names: northstar, Halcyon, Bramble, cirrato, RAKURI, SeatLine, SUSE‑like, Wolt‑ish) in `--ink-soft`, opacity 0.78, **44px** gap. Replace with real customer logos.

### 4. Dashboard Mockup (inside hero)
A dark "product screenshot" used as the hero's main visual. **Not an interactive component** — purely decorative; in production this could be (a) a real screenshot, (b) a static SVG, or (c) re-implemented as JSX with the same shell. Structure:

- Outer container: 18px radius, gradient bg `oklch(0.2 0.025 220)` → `oklch(0.16 0.022 220)`, 1px border `oklch(0.32 0.018 220)`, 14px padding, lifted shadow.
- Title bar: 3 dim macOS dots + mono path `app.qabase.dev / releases / 24.07`.
- Body: 3-column grid **200px / 1fr / 320px**, dark navy surfaces, 12px radius.
  - **Left rail:** Workspace (Overview, Test runs [active], Releases, Suites, Reports), Projects (Checkout, Onboarding, Mobile iOS, Public API) — each as a `.item` with a colored 8×8 square.
  - **Center:** tab strip (All runs [active] / Failures · 12 / Flaky · 4 / Skipped · 6 / Sort: latest), then a list of **9 test rows**. Each row: 22px colored icon (P/C/O/M/A letter), test name, status chip, mono duration, mono run id.
  - **Right rail:** two stat cards.
    - Card 1: "Release confidence" — value `94.2 /100`, delta `▲ 3.1 vs. last release`, mini bar chart 10 bars heights `[30, 45, 38, 60, 52, 70, 64, 82, 76, 92]%`.
    - Card 2: "Coverage by surface" — 4 rows (Checkout 92%, Onboarding 87%, Mobile iOS 73%, Public API 64%) each with a colored swatch.

### 5. "The Gap" Section
- Background: `--bg-tint`.
- Section head: eyebrow `THE GAP`, H2 `Development got faster. QA didn't.` (last 2 words = Fraunces italic-feel in `--accent-deep`), paragraph `Test debt compounds…`.
- **Compare grid (1080px max):** 3-column `1fr / 56px / 1fr`, white surface, 18px radius, 1px border.
  - Left col `.compare-col.bad` (subtle warm bg), heading `WITHOUT QABASE` mono 12px tracked, 4 items each with red ✕ icon (18×18, `oklch(0.95 0.005 30)` bg, `oklch(0.5 0.1 30)` glyph) + dashed top borders.
  - Right col `.compare-col.good` (linear gradient of teal tints), heading `WITH QABASE` in `--accent-deep`, 4 items each with `--accent` filled ✓ circle + white glyph.
  - Center: thin 56px column with `→` glyph in `--accent-deep`, 22px, between thin vertical borders.

### 6. Quote Section
- White bg, centered.
- Eyebrow `IN A WORD`.
- Big pull quote in **Fraunces** 400, clamp 28–40px, line-height 1.2, color `--accent-deep`. Copy: `"With QABase, you'll never have to ask: are we good to ship?"` (line break before `are we`).
- Attribution: mono 12px `--muted`, uppercase tracked. `Maya Otieno · Staff Engineer, Halcyon`.

### 7. Three Alternating Feature Blocks
Container background `--bg-tint`. Each block is a 2-column grid (`1fr 1.15fr`), alternating sides (`.reverse` swaps). 56px column gap, 56px row gap between blocks.

- **Copy column:** eyebrow → H3 → 46ch paragraph → underlined accent link "Learn more →".
- **Visual column:** rounded teal-tinted gradient surface (135deg `oklch(0.96 0.02 188)` → `oklch(0.98 0.01 188)`), 1px `--line` border, 18px radius, 28px padding, 4:3 aspect ratio, contains a dark "feature-card" with a chrome bar (3 dots + filename).

Block 1 — Coverage at a glance:
- H3: `See all results in one view with zero blind spots.`
- Visual: results list — 6 rows, each with a colored swatch + name + mono status. (See HTML for exact rows: smoke passes, regression passes, E2E fail, visual flaky, API passes, manual queued.)

Block 2 (reversed) — Automation:
- H3: `Turn test debt into test automation.`
- Visual: code block, `checkout.spec.ts`, Playwright TS sample with syntax highlighting (`.k` teal keywords, `.s` warm strings, `.c` muted comments, `.ok` green chain methods). Exact code in the HTML.

Block 3 — Release confidence:
- H3: `Replace release anxiety with release confidence.`
- Visual: a 2×2 release board tile grid — Passing 241/268 (green), Failing 18/2 blockers (red), Flaky 6/under triage (amber), then a full-width tile (span 1 / -1) gradient with `Ship on Tue · 94.2`.

### 8. Integrations (dark)
- Background `--dark`, white text.
- Section head eyebrow `INTEGRATIONS` in `oklch(0.75 0.12 188)`, H2 `Deep integrations with the tools your team already runs.` (last clause Fraunces accent), `--on-dark-soft` lede.
- **Grid:** 8 cols × 2 rows = **16 tiles**, max 880px wide, 14px gap. Each tile: 1:1 aspect, 12px radius, `oklch(0.22 0.022 220)` bg, 1px border `oklch(0.3 0.018 220)`, centered 30×30 colored glyph chip with single letter/symbol. Hover: lift -2px, lighten bg.
- In production, replace each `.glyph` with the real product SVG (GitHub, Jira, Linear, Playwright, Cypress, Selenium, Slack, etc.).
- Below grid: `View all 38 integrations →` link in `oklch(0.78 0.12 188)`.

### 9. Studies
- White bg.
- H2: `QABase studies`.
- **Stats row:** 4-col grid, white tiles, 14px radius, 1px `--line`. Each tile shows `<value> → <accent value>` in Geist 28px/500, then `--muted` description.
  - `Weeks → hours` — regression suite update time.
  - `Days → minutes` — requirement → CI coverage.
  - `1,500 → 3,500` — cases under maintenance.
  - `2×` — faster QA per release.
- **Featured study card:** dark 2-col grid (`1fr 1.1fr`), 16px radius, min-height 280px.
  - Left: gradient cover (`oklch(0.42 0.1 195)` → `oklch(0.28 0.05 215)` with a radial teal accent), centered "Halcyon" wordmark with a CSS-masked donut glyph (radial mask).
  - Right: 34px padding, `CASE STUDY` mono tag in `oklch(0.78 0.12 188)`, H3 `How Halcyon matured QA without doubling the team.`, paragraph, `Read the study →` link.

### 10. Features Grid
- Background `--bg-tint`, with a large blurred radial accent at top-right (`oklch(0.7 0.14 188 / 0.18)`) as ambient flourish.
- Head: 2-col flex, left = eyebrow + H2 `Features that smooth quality for everyone.`, right = `Full platform tour →`.
- **Grid:** 4 cols × 2 rows = **8 tiles**, 14px gap. Each tile: white, 14px radius, 1px `--line`, 22px padding.
  - 32×32 icon chip in `--accent-soft` bg with `--accent-deep` inline SVG glyph.
  - H4 (15.5px/500), then 13.5px `--muted` description.
- Tiles:
  1. **Centralized run history** — every result, every branch, searchable.
  2. **Requirement traceability** — req↔case↔result.
  3. **Flaky test velocity** — detect, quarantine, own.
  4. **Shareable read‑only views** — one link, one truth.
  5. **Trend & flake analytics** — pass-rate over time.
  6. **SLA‑aware alerting** — P0 only.
  7. **SOC 2 + role security** — SCIM/SSO/roles.
  8. **AI test review** — root cause second opinion.

### 11. Bottom CTA (dark)
- `--dark` bg, 80px vertical padding, two diagonal radial accents (`oklch(0.5 0.14 188 / 0.3)` and `oklch(0.4 0.1 200 / 0.3)`).
- 2-col grid, 60px gap.
  - Left: H2 `Ship quality software faster with QABase.` (last 2 words Fraunces accent in `oklch(0.82 0.12 188)`), paragraph, 2 CTAs (`Start free` accent + `Book a demo` outline-on-dark).
  - Right: a rotated (-1deg) mini dashboard tile — title bar dots + path, dark inner card with `Release confidence 94.2 ▲ 3.1`, 7-bar mini chart, 3 stats row (Passing 241 / Failing 18 / Flaky 6).

### 12. FAQs
- White bg, 760px max content width.
- Each row: 22px vertical padding, top hairline `--line`, last child also bottom hairline.
- Layout: 2-col `1fr 24px` — question left, toggle right; answer spans both columns (hidden, `max-height: 0`, transitions to ~300px when `.open`).
- Toggle: 24×24 circle, 1px `--line-strong` border, `+` glyph; when open: `--accent` fill, white glyph, rotated 45deg → renders as `×`.
- First FAQ is open by default. Clicking another collapses the current and opens the new one (single-open accordion).
- 7 FAQs — see HTML for full Q&A copy.

### 13. Newsletter
- `--bg-tint` bg, 1px top border, 56px vertical padding.
- 2-col `1fr 1.2fr`, 40px gap.
- Left: H3 `Sign up for the QABase newsletter`, supporting paragraph.
- Right: form — email input (12/14px padding, 8px radius, `--line-strong` border, focus → `--accent` ring) + `Subscribe` primary button. On submit: clears input, button label becomes `✓ Subscribed` (no real backend).

### 14. Footer
- White bg, 60px top padding.
- Grid `1.4fr repeat(4, 1fr)`, 32px gap, bottom border.
- Left brand column: logo + 32ch description + 3 mono badges (`SOC 2 · TYPE II`, `GDPR`, `ISO 27001`).
- 4 link columns: Platform, Solutions, Resources, Company — each with mono uppercase H5 + 5 links.
- Bottom bar: copyright `© 2026 QABase, Inc.` + Privacy / Terms / Security links.
- **Watermark:** giant `QABase` in Fraunces, clamp(140–260px), `oklch(0.94 0.025 188)`, centered, overflow hidden, slight negative margins to bleed.

---

## Interactions & Behavior

- **Sticky nav:** stays at top with backdrop blur. No active state required for marketing.
- **Dropdown indicators (▾):** placeholders — currently not wired. In production, hover/click should reveal a mega-menu (out of scope for this design pass).
- **Hover states:** buttons (`-2px` transform on `.int-tile`, color/bg shifts on `.btn-*`), nav link bg fill, footer link → `--accent-deep`.
- **FAQ accordion:** click toggles `.open`; one open at a time. Transition `max-height 0.25s ease, margin-top 0.25s ease`. Toggle glyph rotates 45deg on open.
- **Newsletter:** prevent default, swap button label, clear input. Wire to ESP (Customer.io/Loops/etc.) in production.
- **Responsive:** single breakpoint at 980px. Below that, the dashboard sidebars and compare arrow column hide; multi-column grids collapse. **TODO for the developer:** add a smaller mobile breakpoint (~640px) and a hamburger nav.

## State Management
- **FAQ open state** — locally on each item (`.open` class), single-open enforced.
- **Newsletter form state** — local form state (idle / submitting / success). Wire to ESP backend.
- No global state needed for this page.

## Accessibility Notes (please uplift in production)
- The HTML uses `<div>` for FAQ rows + click handler. **Re-implement FAQs with `<button aria-expanded>` + region pattern**, keyboard-focusable, Enter/Space to toggle.
- All inline SVG icons are decorative — add `aria-hidden="true"` and `focusable="false"`.
- Add `aria-label` to nav landmarks: `<nav aria-label="Primary">`, `<nav aria-label="Footer">`.
- Hero badge, announcement bar, and CTA buttons all use real `<a>` tags — keep that pattern (no `<div onclick>`).
- Provide visible focus styles for all interactive elements (currently only inputs have explicit focus rings).
- Color contrast: `--ink-soft` on `--bg-tint` passes WCAG AA at 16px+. `--muted` on white is borderline at 13.5px — verify with the actual rendered values.

## Assets

**No real product assets are bundled.** Everything in the design is generated from CSS, inline SVG, and text:
- Customer logos in the trust strip are plain wordmarks — replace with real SVG logos (8–10 customers).
- Integration tiles use a single colored letter/glyph — replace each with the real brand SVG.
- The "Halcyon" case study cover uses a CSS-masked donut for the avatar — replace with the real customer's logo.
- The dashboard screenshot is fully CSS — you can either keep that (port to a `<DashboardMock />` component), replace with a real screenshot, or build it as a real component using your product's UI kit.

## Files
- `QABase Landing.html` — single-file design reference. View directly in a browser.

## Fonts to Add to the Codebase
Google Fonts, all weights actually used:
- Geist: 400, 500, 600
- Geist Mono: 400, 500
- Fraunces: 400 (with opsz 9–144)

Either self-host or load via `next/font/google` / `@fontsource`.

## Suggested Component Breakdown
If reaching for React/Vue/Svelte components, a reasonable decomposition:

```
<AnnouncementBar />
<SiteNav />
<HeroSection>
  <HeroBadge />
  <Headline />
  <CTAs />
  <DashboardMock />     // big decorative product shot
  <TrustStrip />
  <CustomerLogos />
</HeroSection>
<TheGapSection>
  <CompareTable items={[...]} />
</TheGapSection>
<PullQuote />
<FeatureStack>
  <FeatureBlock variant="image-right" />
  <FeatureBlock variant="image-left" />
  <FeatureBlock variant="image-right" />
</FeatureStack>
<IntegrationsSection integrations={[...]} />
<StudiesSection stats={[...]} featured={{...}} />
<FeatureGrid features={[...]} />
<BottomCTA />
<FAQSection items={[...]} />
<NewsletterSignup />
<SiteFooter />
```

Pull all content (headlines, paragraphs, FAQ Q&A, feature lists, stats) into a CMS or a single TS data file so marketing can edit copy without touching components.
