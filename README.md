# NeusicWave

**Something new is arriving.**

This repository powers the public NeusicWave teaser and early-access waitlist hosted on GitHub Pages.

## Public launch

- Teaser landing: `https://bnsceo.github.io/NeusicLabV1/`
- TikTok: `@neusicwave`
- Instagram: `@neusicwave`
- Waitlist responses are submitted to the connected Google Form and stored in its linked Google Sheet.

## Current campaign

The root landing page is intentionally teaser-only:

- no product reveal
- no screenshots or feature showcase
- one email waitlist action
- dark neon NeusicWave branding
- custom signup success message
- mobile-first layout

The underlying Neusic music applications remain in the repository and can continue to be developed independently without being promoted from the public teaser page.

## Main files

- `index.html` — public teaser landing
- `css/landing/neusicwave-teaser.css` — teaser design and responsive layout
- `scripts/landing/neusicwave-teaser.js` — Google Forms waitlist submission and success dialog
- `assets/icons/neusicwave-logo.svg` — campaign logo asset
- `.github/workflows/deploy-neusic-pages.yml` — GitHub Pages deployment

## Waitlist connection

The landing page posts directly to the published NeusicWave Google Form using the form response endpoint and the validated email field.

Before sharing the site publicly, submit a real test email and confirm it appears in:

1. Google Forms → **Responses**
2. The linked **NeusicWave Waitlist** Google Sheet

## Deployment

Changes pushed to `main` automatically deploy through GitHub Actions to GitHub Pages.

```text
main → Deploy Neusic Pages → GitHub Pages
```

## Status

**Teaser campaign:** launch preparation  
**Product reveal:** intentionally hidden  
**Waitlist:** connected to Google Forms

© NeusicWave · Made by Anderson Paulino
