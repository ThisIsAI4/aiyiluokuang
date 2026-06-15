---
version: alpha
name: ChatHub-Light-Theme
description: A clean light-theme design system for ChatHub — inspired by DeepSeek's airy clarity and Qwen's purple accent. White canvas, generous spacing, and a single violet brand color carry the entire UI.

colors:
  primary: "#615ced"
  primary-soft: "#7a76f2"
  primary-deep: "#4a46c0"
  on-primary: "#ffffff"
  ink: "#1a1a2e"
  ink-strong: "#000000"
  body: "#6b6b7b"
  mute: "#9a9aaa"
  hairline: "#e8e8ef"
  hairline-strong: "#d0d0de"
  hairline-soft: "#b8b8c8"
  canvas: "#ffffff"
  canvas-soft: "#f7f7fb"
  surface-1: "#ffffff"
  surface-2: "#f0f0f5"
  surface-3: "#e8e8ef"

gradient:
  main: "linear-gradient(90deg, #615ced, #8b5cf6, #c4b5fd)"

typography:
  display-xl:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif
    fontSize: 48px
    fontWeight: 500
    lineHeight: 52px
    letterSpacing: -0.5px
  display-lg:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif
    fontSize: 32px
    fontWeight: 500
    lineHeight: 36px
    letterSpacing: -0.4px
  display-md:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif
    fontSize: 22px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: -0.2px
  display-sm:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif
    fontSize: 18px
    fontWeight: 600
    lineHeight: 24px
  eyebrow-mono:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 12px
    fontWeight: 600
    lineHeight: 16px
    letterSpacing: 1.5px
    textTransform: uppercase
  body-lg:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
  body-md:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 22px
  body-md-strong:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 14px
    fontWeight: 600
    lineHeight: 22px
  body-sm:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
  body-sm-strong:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 13px
    fontWeight: 600
    lineHeight: 20px
  caption:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
  code:
    fontFamily: JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace
    fontSize: 12px
    fontWeight: 400
    lineHeight: 18px
  button-md:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 13px
    fontWeight: 600
    lineHeight: 20px

rounded:
  none: 0px
  xs: 4px
  sm: 8px
  md: 12px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
  4xl: 40px
  5xl: 48px
  6xl: 64px

components:
  nav-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    padding: "{spacing.md} {spacing.3xl}"
  nav-link:
    textColor: "{colors.body}"
    typography: "{typography.body-sm}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md} {spacing.lg}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    borderColor: "{colors.hairline}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md} {spacing.lg}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md} {spacing.lg}"
  button-pill-tag:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.body}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "{spacing.xs} {spacing.md}"
  text-input:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "{spacing.md} {spacing.lg}"
  card-feature:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.2xl}"
    shadow: "0 1px 3px rgba(0,0,0,0.04)"
  code-mockup:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.code}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
  hero-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-xl}"
    padding: "{spacing.5xl} {spacing.3xl}"
  content-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-lg}"
    padding: "{spacing.5xl} {spacing.3xl}"
  footer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    typography: "{typography.body-sm}"
    padding: "{spacing.4xl} {spacing.3xl}"

---

## Overview

ChatHub's design system is a light-theme interface built for clarity and calm. It borrows DeepSeek's airy whitespace and clean card elevations, then anchors the brand with Qwen's violet accent (`#615ced`). The result is a multi-panel chat aggregator that feels modern, approachable, and uncluttered.

**Key Characteristics:**
- White canvas (`#ffffff`) is the only page surface. No dark mode in this iteration.
- A single violet accent (`#615ced`) carries every primary CTA, active tab, and status indicator.
- Cards float on subtle borders (`#e8e8ef`) with gentle shadows — no heavy chrome.
- Inputs use large 12 px radius and soft gray backgrounds (`#f7f7fb`) to feel welcoming.
- Inter + JetBrains Mono pair carries the typographic voice. Mono is reserved for code snippets and chain-mode platform lists.

## Colors

### Brand & Accent
- **Violet** (`{colors.primary}` — `#615ced`): The single brand accent. Every primary CTA, active tab, switch-on state, and running status dot.
- **Primary Soft** (`{colors.primary-soft}` — `#7a76f2`): Hover states for primary buttons and interactive elements.
- **Primary Deep** (`{colors.primary-deep}` — `#4a46c0`): Active/pressed states and inline link color.

### Surface
- **Canvas** (`{colors.canvas}` — `#ffffff`): Default page background.
- **Canvas Soft** (`{colors.canvas-soft}` — `#f7f7fb`): Input fields, code blocks, and subtle secondary surfaces.
- **Surface 2** (`{colors.surface-2}` — `#f0f0f5`): Panel headers, tags, and hover backgrounds.
- **Hairline** (`{colors.hairline}` — `#e8e8ef`): 1 px borders for cards, inputs, and dividers.

### Text
- **Ink** (`{colors.ink}` — `#1a1a2e`): Default text color — a soft near-black that reduces eye strain on white.
- **Ink Strong** (`{colors.ink-strong}` — `#000000`): Pure black for maximum emphasis.
- **Body** (`{colors.body}` — `#6b6b7b`): Secondary text, supporting copy.
- **Mute** (`{colors.mute}` — `#9a9aaa`): Captions, placeholders, and disabled states.

### Semantic
- Success: `#059669`
- Warning: `#d97706`
- Error: `#dc2626`
- Info: `{colors.primary}`

## Typography

### Font Family
- **Inter** for every display, body, button, and link role.
- **JetBrains Mono** for inline code, command snippets, and chain-mode platform lists.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 48px | 500 | 52px | -0.5px | Hero headline |
| `{typography.display-lg}` | 32px | 500 | 36px | -0.4px | Section headlines |
| `{typography.display-md}` | 22px | 600 | 28px | -0.2px | Card titles |
| `{typography.display-sm}` | 18px | 600 | 24px | 0 | Dense grid titles |
| `{typography.eyebrow-mono}` | 12px | 600 | 16px | 1.5px | UPPERCASE eyebrow tags |
| `{typography.body-lg}` | 16px | 400 | 24px | 0 | Lead paragraphs |
| `{typography.body-md}` | 14px | 400 | 22px | 0 | Default body |
| `{typography.body-sm}` | 13px | 400 | 20px | 0 | Secondary body / UI labels |
| `{typography.caption}` | 12px | 400 | 16px | 0 | Fine print |
| `{typography.code}` | 12px | 400 | 18px | 0 | Code blocks, inline snippets |
| `{typography.button-md}` | 13px | 600 | 20px | 0 | Button labels |

## Layout

### Spacing System
- **Base unit**: 4 px
- **Tokens**: `{spacing.xxs}` 2 px · `{spacing.xs}` 4 px · `{spacing.sm}` 8 px · `{spacing.md}` 12 px · `{spacing.lg}` 16 px · `{spacing.xl}` 20 px · `{spacing.2xl}` 24 px · `{spacing.3xl}` 32 px · `{spacing.4xl}` 40 px · `{spacing.5xl}` 48 px · `{spacing.6xl}` 64 px.

### Grid & Container
- Chat panels use CSS Grid with `repeat(N, minmax(0, 1fr))`.
- Gap between panels: `{spacing.sm}` 8 px.
- Panel padding: `{spacing.sm}` to `{spacing.md}`.

### Responsive Strategy
- Mobile: panels stack 1-up, input bar wraps.
- Desktop: multi-column grid up to user's configured max.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Level 0 — Flat | No shadow, hairline border only. | Full-bleed bands, base cards. |
| Level 1 — Subtle | `0 1px 3px rgba(0,0,0,0.04)` + hairline border. | Default chat panels. |
| Level 2 — Hover | `0 2px 8px rgba(0,0,0,0.06)` + stronger border. | Panel hover state. |
| Level 3 — Modal | `0 8px 32px rgba(0,0,0,0.08)` heavy drop. | Modal / drawer surfaces. |

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | Small inline elements, tags. |
| `{rounded.sm}` | 8px | Buttons, inputs, small cards. |
| `{rounded.md}` | 12px | Chat panels, code blocks, modals. |
| `{rounded.pill}` | 9999px | Status tags, pill buttons. |

## Components

### Buttons
**`button-primary`** — violet CTA.
- Background `{colors.primary}`, text `{colors.on-primary}`, shape `{rounded.sm}` 8 px.

**`button-outline`** — hairline secondary.
- Transparent background, text `{colors.body}`, 1 px `{colors.hairline}` border.

**`button-ghost`** — text-only tertiary.
- Transparent background, text `{colors.primary}`, no border.

**`button-pill-tag`** — inline category/status pill.
- Background `{colors.surface-2}`, text `{colors.body}`, hairline border, shape `{rounded.pill}`.

### Cards & Containers
**`card-feature`** — default floating card.
- Background `{colors.surface-1}`, 1 px `{colors.hairline}` border, subtle shadow, shape `{rounded.md}` 12 px.

**`code-mockup`** — code block container.
- Background `{colors.canvas-soft}`, 1 px `{colors.hairline}` border, shape `{rounded.md}`.

### Inputs & Forms
**`text-input`** — standard text input.
- Background `{colors.canvas-soft}`, text `{colors.ink}`, 1 px `{colors.hairline}` border, shape `{rounded.md}` 12 px.

### Navigation
**`nav-bar`** — top nav on white.
- Background `{colors.canvas}`, text `{colors.ink}`.

**`footer`** — bottom band.
- Background `{colors.canvas}`, text `{colors.body}`.

## Do's and Don'ts

### Do
- Reserve `{colors.primary}` (`#615ced`) for primary CTAs, active states, and running indicators.
- Use white (`#ffffff`) as the only page background.
- Build cards with 1 px `{colors.hairline}` borders plus subtle shadows.
- Use `{rounded.md}` 12 px for chat panels and large inputs.
- Keep body text at `#1a1a2e` (not pure black) for comfortable long-form reading.

### Don't
- Introduce a dark mode counterpart in this iteration.
- Use the primary violet as body text fill. It's CTA-only.
- Drop heavy drop-shadows on cards. Keep elevations subtle.
- Use pure black (`#000000`) for default text. Stick to `#1a1a2e`.
