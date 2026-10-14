# gladys-nina

[Gladys Assistant](https://gladysassistant.com) external integration for
**NINA**, the German federal warning system of the BBK: the official civil
protection, weather, flood and police warnings in force for the municipality
of your house, scene triggers, a scene action and a dashboard widget.
**Unofficial connector, not affiliated with the BBK. Not a safety system:
rely on the official channels (NINA app, sirens, radio).** Source: BBK / NINA
(warnung.bund.de).

User documentation: [docs/en.md](docs/en.md) · [docs/fr.md](docs/fr.md).

## How it works

```
Gladys ⇄ SDK ⇄ src/app.js (NinaApp)
                 ├─ src/nina.js       dashboards, warning details, the web app's municipality files
                 ├─ src/places.js     directory, ARS, grid cells, outlines, "does it concern the place" (pure)
                 ├─ src/model.js      dashboard item + CAP details -> warning, reading (pure)
                 ├─ src/devices.js    devices, states (pure)
                 ├─ src/triggers.js   two readings -> scene events (pure)
                 └─ src/widget.js     the "warnings" widget (pure)
```

- **Places**: a located house becomes a municipality the way the official
  web app (warnung.bund.de) does it: the grid cell of the point
  (`grid_zgem_mapping.json`), then the outline of the municipalities of that
  cell (`gemeinden_polygons/<id>.geojson`). Municipalities can also be typed
  by name or ARS (`converted_gemeinden.json`).
- **Reading**: NINA serves warnings per district (`/api31/dashboard/<ARS
of the district>.json`, conditional GET with the ETag), every 5 minutes by
  default; an item is kept when its area names the municipality (`ZGEM`) or
  one of its grid cells (`GRID`), like the official app. The CAP details
  (`/api31/warnings/<id>.json`) are read once per version of a warning.
- **Triggers** come from two consecutive readings: a new warning (or a new
  version that got more severe, its identity followed through the CAP
  `references`), a warning ended (all clear, expired, withdrawn). The first
  reading fires nothing.

## Development

```bash
npm install
npm test                                        # node --test, no network
npm run lint && npm run format:check
npx github:GladysAssistant/integration-store .  # store admission checks
```

The fixtures in `test/fixtures/` are real answers recorded on 2026-10-14 (a
district dashboard, warning details, subsets of the municipality files).

## Releasing

**Actions → Release → Run workflow** (patch / minor / major): bumps the
version in `package.json` and the manifest, rolls `CHANGELOG.md`, tags, builds
the multi-arch image to GHCR and publishes the GitHub Release.

## License

Apache-2.0. The warnings are the BBK's: they may only be used unchanged in
content and not for commercial purposes.
