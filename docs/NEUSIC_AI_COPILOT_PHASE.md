# Neusic Landing and Production Copilot Phase

## Release objective

This phase separates product marketing from the production workspace and introduces project-aware assistance without weakening the browser DAW's security model.

## Public site architecture

- `/` is the Neusic product landing page.
- `/studio/` is the production DAW.
- The landing page uses the same graphite, steel, amber, recessed-display, and hardware-control visual language as the app.
- Shipped capabilities are separated from current and native-desktop roadmap work.

## Production Copilot

The Copilot drawer reads structured project state already present in Neusic:

- project name, template and BPM
- track names, types, instruments and clip counts
- clip positions and lengths
- song sections and loop region
- track faders, mute, solo, arm and insert-effect names

It does not serialize or transmit decoded AudioBuffers.

### Local mode

Local mode works without a model or API token and provides:

- session diagnosis
- arrangement review
- mix and headroom checks
- track-role review
- explicit actions for song-map creation, conservative headroom and bus creation

### Hermes mode

Hermes mode sends the same structured summary to a separately hosted bridge. The browser never receives Hermes provider credentials.

The included bridge calls Hermes scripted one-shot mode and selects `context_engine`, an empty toolset. The integration is advisory-only. Neusic remains the authority for project changes and requires the producer to press an action button.

## Next production layer

1. Dedicated Neusic MCP server with schema-validated read tools.
2. Approval-gated write tools for creating sections, tracks and clips.
3. Audio-feature summaries computed locally before model requests.
4. Versioned assistant actions with undo receipts.
5. Complete bus and return routing matrix.
6. Take lanes and vocal comping.
7. Freeze, flatten and bounce-in-place.
8. User-owned encrypted cloud project sync.
