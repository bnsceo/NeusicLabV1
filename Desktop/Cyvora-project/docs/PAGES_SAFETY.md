# Cyvora GitHub Pages Safety Boundary

## Canonical showcase

Only `docs/cyvora-full-app-showcase.html` is deployed to GitHub Pages.

The workflow copies it to the deployment artifact as `index.html`.

## Public landing and product tour

The canonical file includes:

1. A public landing screen.
2. A fully mocked interactive app showcase.
3. A link to the separately hosted real application.

## Authentication boundary

The public Pages site does **not** implement authentication.

The `Unlock / Sign In` action opens:

```text
https://cyvoraai.fly.dev/unlock
```

in a separate browser tab. Authentication, cookies, access-code validation, sessions, middleware, and logout remain entirely inside the real Next.js application.

## Never include on Pages

- Secrets or API keys
- Access codes or passwords
- Private runtime URLs
- Server routes
- Worker code
- Databases or tenant files
- Real customer information
- Live connector operations
- Payment processing
- Mutation endpoints

## Static mock rule

Every company, task, output, approval, cost, incident, connector, and worker state shown on Pages must be fictional or explicitly mocked.
