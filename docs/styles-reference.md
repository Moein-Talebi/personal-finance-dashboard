# CSS Styles Reference

> **Purpose**: Complete reference for styles.css. Use this instead of reading the CSS file.
> Last updated: 2026-08-18

**File**: `public/css/styles.css` (1,091 lines)
**Fonts**: Google Fonts - Outfit (300-800) & Plus Jakarta Sans (300-700)

---

## Theme System

Light theme: `:root` variables. Dark theme: `body[data-theme="dark"]` overrides.
Smooth transition via body `background-color 0.3s, color 0.3s`.

### CSS Variables

| Variable | Light | Dark | Purpose |
|---|---|---|---|
| --bg-app | #F8F9FD | #0A0A10 | Page background |
| --bg-card | #FFFFFF | #151421 | Card/modal surface |
| --bg-sidebar | #FFFFFF | #11101A | Sidebar background |
| --bg-sidebar-hover | #F6F4FE | #1D1B2D | Hover state for nav items |
| --border-color | #ECEAF4 | #242236 | Structural borders |
| --border-focus | #6E54FF | #826BFF | Input focus border |
| --text-primary | #1F1D2C | #F3F1FB | Main text |
| --text-secondary | #6B6880 | #9E9BB3 | Subtitles/labels |
| --text-muted | #9592AC | #726F8B | Captions/timestamps |
| --color-primary | #6E54FF | #7664E4 | Brand purple |
| --color-primary-hover | #583DF2 | #8D7DFA | Primary hover |
| --color-primary-light | #ECEAFF | #201E35 | Primary badge bg |
| --color-success | #29D832 | #43EC4B | Success green |
| --color-success-bg | #E7FBE8 | #142E18 | Success badge bg |
| --color-warning | #FF970C | #FFAB2E | Warning orange |
| --color-warning-bg | #FFF5E7 | #30210E | Warning badge bg |
| --color-danger | #E83838 | #FF5A5A | Danger red |
| --color-danger-bg | #FFEBEB | #341518 | Danger badge bg |
| --color-info | #4A98FF | #5CA6FF | Info blue |
| --color-info-bg | #EBF4FF | #132238 | Info badge bg |
| --radius-sm | 8px | - | Small radius |
| --radius-md | 14px | - | Medium radius |
| --radius-lg | 24px | - | Large radius |
| --radius-full | 50px | - | Pill radius |
| --shadow-sm | subtle purple | subtle black | Small shadow |
| --shadow-md | medium purple | medium black | Card shadow |
| --shadow-lg | large purple | large black | Modal shadow |
| --font-sans | Outfit, Plus Jakarta Sans, system-ui | - | Font stack |
| --transition-fast | 0.15s cubic-bezier(0.4,0,0.2,1) | - | Hover |
| --transition-normal | 0.3s cubic-bezier(0.4,0,0.2,1) | - | Theme toggle |

---

## Layout Architecture

- `.app-layout`: Flex, min-height 100vh
- `.sidebar`: Fixed left, width 280px, z-index 50
- `.main-wrapper`: margin-left 280px, flex column
- `.topbar`: Sticky, height 90px, z-index 40
- `.page-container`: padding 2.5rem, flex 1

## Grid Systems
- `.grid-cols-4`: repeat(auto-fit, minmax(220px, 1fr)), gap 1.5rem
- `.grid-cols-2`: repeat(auto-fit, minmax(420px, 1fr)), gap 2rem
- `.budget-grid`: repeat(auto-fill, minmax(280px, 1fr)), gap 1.5rem
- `.goals-grid`: repeat(auto-fill, minmax(320px, 1fr)), gap 1.5rem
- `.form-row`: 2-column grid (1fr 1fr), gap 1.25rem

---

## Component Classes

### Buttons
- `.btn`: base pill button (gap 0.65rem, padding 0.75rem 1.5rem, weight 700)
- `.btn-primary`: purple fill, white text, hover translateY(-2px)
- `.btn-secondary`: primary-light bg, purple text
- `.btn-outline`: transparent, border, hover bg-sidebar-hover
- `.btn-danger`: red fill, white text
- `.btn-sm`: compact (0.45rem 1rem, 0.82rem font)
- `.icon-btn`: 44x44 circle button

### Cards
- `.card`: bg-card, border, radius-lg (24px), padding 1.75rem, shadow-md
- `.stat-card`: column flex metric display
- `.stat-icon`: 40px circle with color variants (.primary, .success, .danger, .warning)
- `.stat-value`: 2rem, weight 800
- `.finance-card`: credit card style, min-height 180px, hover translateY(-4px)
- `.finance-card-gradient-1/2/3`: purple/cyan/blue gradients

### Status & Badges
- `.status-pill`: rounded pill badge
  - `.success/.successful/.active`: green
  - `.warning/.pending/.attention`: orange
  - `.danger/.cancelled/.exceeded`: red
  - `.info/.refund/.inactive`: blue
- `.trend-badge`: up (green), down (red), flat (blue)
- `.dot-badge`: 9px red notification dot

### Progress Bars
- `.progress-bar-bg`: 8px track, radius-full
- `.progress-bar-fill`: colored fill, 0.6s transition

### Tables
- `.table-container`: overflow scroll wrapper
- `th`: uppercase, 0.82rem, weight 700, letter-spacing 0.05em
- `td`: padding 1.25rem, hover row highlight

### Forms
- `.form-group`: flex column, gap 0.5rem, margin-bottom 1.5rem
- `.form-control`: bg-app, border, radius-md, padding 0.85rem 1.15rem
- `.form-control:focus`: border-focus + box-shadow 4px primary-light

### Modal
- `.modal-backdrop`: fixed fullscreen, rgba(11,10,20,0.6), blur(8px), z-index 100
- `.modal-box`: max-width 520px, radius-lg, padding 2.25rem, shadow-lg, modalPop animation
- `.modal-tabs` + `.modal-tab-btn`: segmented pill switcher

### Toast
- `.toast-container`: fixed bottom-right, z-index 200
- `.toast`: min-width 320px, radius-md, toastSlideIn animation
- `.toast.success/danger/warning`: 4px colored left border

### Chips
- `.chip-grid`: flex wrap container
- `.chip-tag`: pill tag, hover/active -> primary colors

### Donut Chart
- `.donut-widget`: flex container for chart + legend
- `.donut-chart-container`: 160x160px
- `.donut-center-label/value/sub`: centered overlay text
- `.donut-legend` + `.legend-item` + `.legend-color`: legend list

---

## Animations

### modalPop
```css
from { transform: scale(0.9) translateY(20px); opacity: 0; }
to { transform: scale(1) translateY(0); opacity: 1; }
```
Timing: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)

### toastSlideIn
```css
from { transform: translateX(120%); opacity: 0; }
to { transform: translateX(0); opacity: 1; }
```
Timing: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)

---

## Responsive Breakpoints

### @media (max-width: 992px) - Tablet
- `.sidebar`: translateX(-100%), hidden by default
- `.sidebar.open`: translateX(0), shadow-lg
- `.main-wrapper`: margin-left 0
- `.mobile-only`: display inline-flex

### @media (max-width: 576px) - Mobile
- `.topbar`: padding reduced, height 80px
- `.page-container`: padding 1.25rem
- `.grid-cols-2`: single column
- `.form-row`: single column
- `.donut-widget`: flex-direction column

---

## Utility Classes
- `.hidden`: display none !important
- `.mobile-only`: hidden on desktop
- `.flex-between`: justify-content space-between, align-items center
- `.m-bottom-4/6/8`: margin-bottom 1rem/1.5rem/2rem
- `.text-success/danger/warning/muted`: color overrides !important
