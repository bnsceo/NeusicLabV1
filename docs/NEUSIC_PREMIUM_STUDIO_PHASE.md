# Neusic Premium Studio Phase

## Objective

Refine Neusic into a premium hardware-studio experience with a deliberate typography system, collision-resistant controls, and user-owned visual themes.

## Typography

- **Display and logo:** Clash Display
- **Interface and body:** Satoshi with Manrope fallback
- **Production data:** JetBrains Mono
- Timecode, BPM, latency, meter values, counters and numeric inputs use tabular numerals.
- Uppercase labels use increased tracking for readability in dense layouts.

The font stack uses network-hosted styles when available and retains system fallbacks when the studio is offline.

## Control geometry

The final CSS layer standardizes:

- top-bar button dimensions
- icon boxes
- transport spacing
- horizontally scrollable toolbars and drawer tabs
- selected-track command-strip overflow
- track header action placement
- mobile action grids
- track creator responsive layout
- focus-visible states

Controls scroll instead of overlapping when the available width is narrow.

## Theme personalization

The **THEME** control in the top bar opens a studio personalization panel.

Users can select:

- Studio Gold
- Electric Blue
- Emerald
- Violet
- Crimson
- Ice
- any custom accent color
- Graphite, Obsidian or Slate console finishes
- Comfortable or Compact interface density

Preferences are stored locally under `neusic-theme-v1`. The landing-page swatches use the same key, so a choice made before launching the studio carries into the DAW.

## Landing page

The landing page now uses the premium typography and hardware language, includes a theme preview, and contains no GitHub or repository buttons.

## Hermes startup behavior

The local runtime no longer blocks Neusic while waiting for an inference response. Startup performs a lightweight Hermes CLI check, opens the studio even when provider verification is unavailable, and leaves Local Copilot usable. A deeper inference check remains available as an explicit diagnostic.
