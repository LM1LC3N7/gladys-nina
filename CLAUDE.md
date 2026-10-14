# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for
human contributors.

## What this is

A Gladys Assistant **external integration** of type `device`: a Node.js
service (Node 22+, ESM, no build step) in its own sandboxed Docker container,
talking to Gladys through `@gladysassistant/integration-sdk` (v0.15). It
reads the public **NINA** API of the BBK (warnung.bund.de, no key) and turns
the warnings in force for the municipality of each located house (and of
typed municipalities) into devices, two scene triggers, a scene action and a
dashboard widget. Unofficial: not affiliated with the BBK. Complements
`gladys-dwd` (same author): NINA relays the DWD severe weather warnings too,
which the user can leave out ("Sources to keep").

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/app.test.js              # one file
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npm run audit                             # npm audit --omit=dev
npx github:GladysAssistant/integration-store .   # store admission checks
```

Run `format:check`, `lint`, `test` and `audit` before every commit.

## Architecture

```
index.js            SDK wiring only (handlers registered before connect())
src/app.js          NinaApp: directory, grid, houses located, typed places,
                    discovery, refresh loop, details cache, scene action,
                    widget, buttons
src/nina.js         the client: dashboard (conditional GET), warning details,
                    the web app's municipality files and polygons
src/places.js       directory, name/ARS -> place, search, grid cell, grid scan,
                    point in outline, "does this item concern the place" (pure)
src/model.js        dashboard item + CAP details -> warning, reading (pure)
src/devices.js      devices, feature keys, external ids, states (pure)
src/triggers.js     readings -> scene events, warning identity (pure)
src/widget.js       the "warnings" widget (pure)
src/config.js       config_schema normalized
src/constants.js    endpoints, grid, pacing, limits, manifest keys
src/i18n.js         runtime texts, warning words, feature names (en/fr/de)
src/http.js         the only network access (fetch, timeout, User-Agent, ETag)
test/fixtures/      real answers (2026-10-14): a dashboard, three warning
                    details (de/en/fr blocks kept), subsets of the web app's
                    municipality, district and grid files, three outlines
test/helpers/       a fake warnung.bund.de (fetch), fake timers; Gladys is the
                    SDK's fake
```

## What is known of NINA (recorded on 2026-10-14)

- **Dashboard** `GET /api31/dashboard/<ARS>.json`: districts only (5 digits
  then `0000000`; a municipality ARS is a 404). `[]` or items `{ id, payload:
{ version, hash, data: { headline, provider, severity, urgency, msgType,
transKeys, area: { type, data }, valid } }, i18nTitle, sent }`. Sent with
  an ETag: `If-None-Match` gets a 304. `cache-control: max-age=10`.
- **The area of an item** (`payload.data.area`): `ZGEM` lists municipality
  ids of the web app's `converted_gemeinden.json` (not ARS), `GRID` lists
  cells of its grid; both are ranges `start+count` separated by commas, ended
  by a sentinel (`100001`, `500001`). The official app keeps an item for a
  municipality when its id (ZGEM) or one of its cells (GRID, through
  `grid_zgem_mapping.json`) is listed (`filterForConcreteArea` in
  warnung.bund.de/js/app.js). Only ZGEM was seen live: GRID follows the app's
  code (built blind, see TODO.md).
- **Details** `GET /api31/warnings/<id>.json`: CAP 1.2 as JSON. `references`
  is "sender,identifier,sent" triples separated by spaces: an update or an
  all-clear may carry a NEW id (`...-000` -> `...-001`, or another date) and
  names the previous one there. One `info` block per language (de, de-LS, en,
  ar, es, fr, pl, ru, tr): only the headline is translated (the generic event
  name), the description stays German. `expires` is often absent for MoWaS.
- **All-clear**: an item with `msgType` "Cancel" ("Entwarnung: ..."), listed
  about 6 hours (`expires`).
- **Municipality files of the web app** (`/assets/json/`, read once a day):
  `converted_gemeinden.json` (11,058 municipalities `{ zid: { RS, NAME, KFS,
PKT: "lng,lat", EWZ } }`, the district-free cities without a NAME),
  `converted_kreise.json` (400 districts), `grid_zgem_mapping.json` (5.7 MB,
  1 MB gzip: `{ cell: [zid...] }`, SCANNED with a regex for the needed cells
  and municipalities, never parsed), `gemeinden_polygons/<zid>.geojson`
  (simplified outlines, under 2 KB). The grid constants (`GRID`) come from the
  app's `config.json`, which also holds the app's own API keys: never read it
  at runtime. The formula was checked against the mapping for the 11,058
  municipality points.
- **Terms** (the MoWaS RSS footer): the warnings "may only be used unchanged
  in content and not for commercial purposes".

## Rules

- **Unofficial.** Every user-facing surface says "unofficial connector, not
  affiliated with the BBK". Never use the BBK or NINA logo. Attribution
  "Source: BBK / NINA (warnung.bund.de)" in the docs, the intro and the widget.
- **Not a safety system**: the docs, the config intro and the widget say to
  rely on the official channels (NINA app, sirens, radio). Never word a
  feature as a protection.
- **Texts unchanged**: the official texts are shown as given (HTML turned
  into plain text, cut to Gladys' limits with "…", the link to the full
  message kept); never rewritten nor machine-translated. Titles: the NINA
  translation for the language, else German.
- **Keys are forever**: the manifest keys (`src/constants.js`), the severity
  keys (`minor`, `moderate`, `severe`, `extreme`), the source keys
  (`civil_protection`, `weather`, `flood`, `police`), the end reasons
  (`all_clear`, `expired`, `cancelled`), the feature keys (`FEATURE` in
  `src/devices.js`) and the external id shapes (`house:<selector>`,
  `place:<ARS>`) are stored in user scenes and dashboards. Never rename them.
- **A house is located like the official app does**: grid cell, then the
  outline of the candidate municipalities; a point in a gap of the simplified
  outlines takes the nearest one within `SNAP_KM`. The municipality found is
  stored in the device params (`ars`): the poll path falls back on it when
  the houses cannot be read.
- **Be polite with warnung.bund.de**: one request at a time, a second apart
  (`REQUEST_SPACING`); one dashboard per district per poll (5 minutes by
  default, never below 2), conditional with the ETag; the details once per
  warning version (`revisionOf`); the municipality files once a day; the grid
  file only to locate houses or match a GRID warning, then at most every 10
  minutes (`GRID_RETRY`); the outlines once per municipality tried. Nothing
  is read while no device exists.
- **One event per transition** (`src/triggers.js`): the first reading fires
  nothing; `warning_issued` fires once per minimum severity newly reached (the
  field is matched by equality: "at least severe" is the event of the
  "severe" mark), so a new version fires only when the severity rose; the
  identity of a warning follows its CAP `references`; `warning_ended` fires on
  an all-clear or an expiry at once, on a disappearance after
  `MISSING_READINGS` readings (a dashboard served empty once must not end and
  re-issue a warning). The trackers survive a restart of the app (same
  process) and are reset when the kept sources change.
- **Choices made without the spec** (also in TODO.md): an item without area
  or with an unknown area type counts for the whole district (the official
  app would drop or crash on it: better a warning too many); a severity
  "Unknown" counts as minor; a CAP `status` other than "Actual" (exercise,
  test) is ignored; the scene action reads nothing when a reading exists (and
  fires nothing).
- **Read-only rootfs**: write nothing on disk. House coordinates are personal
  data: never logged nor sent (the grid cell and the outlines are computed
  locally).
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag.
- **Changelog**: every user-visible change adds a line under
  `## [Unreleased]` in `CHANGELOG.md`.
- **Manifest texts** are `{ en, fr, de }` objects; the catalog description holds
  10 to 100 characters per language; `test/manifest.test.js` ties the
  manifest to the code (keys, defaults, options, the trigger fields and
  variables against the events the code sends).
- **User-facing text** is in English, French and German (`src/i18n.js`, the
  manifest, `docs/en.md`, `docs/fr.md` and `docs/de.md` kept in sync): most
  users of a German warning service read German. The German texts say "du",
  like the German Gladys interface, and use its words ("Entdecken",
  "Einstellungen → Zuhause"). `test/manifest.test.js` and
  `test/i18n.test.js` check that no text misses a language. Comments explain
  why, in English.
- **Tests never touch the network** (`installNina` replaces `fetch`); the
  widget contents pass the SDK's `validateWidgetContent`.

## CI and pushes

- Group the commits and push **at most once a day**, unless the maintainer
  explicitly asks otherwise: the GitHub Actions quota is limited.
- If every CI job fails in under 2 seconds, the quota is exhausted: it is
  not a bug in the code.
- The Docker image cannot be built in the Claude Code cloud container (no
  network for `apk` inside `docker build`): the CI builds it.

## Refreshing the fixtures

Few requests, a second apart:

```bash
UA='gladys-nina/dev (+https://github.com/LM1LC3N7/gladys-nina)'
B=https://warnung.bund.de
curl -sA "$UA" --compressed "$B/api31/mowas/mapData.json"            # find current warnings
curl -sA "$UA" --compressed "$B/api31/dashboard/053340000000.json"   # a district with one
curl -sA "$UA" --compressed "$B/api31/warnings/<id>.json"            # its details
for f in converted_gemeinden converted_kreise grid_zgem_mapping; do
  curl -sA "$UA" --compressed "$B/assets/json/$f.json" -o "/tmp/$f.json"
done
curl -sA "$UA" --compressed "$B/assets/json/gemeinden_polygons/3251.geojson"
```

Then keep subsets (the municipalities of the test district, the grid cells of
Alsdorf and Baesweiler, the de/en/fr info blocks of the details): the full
files are 7 MB. `FIXTURE_NOW` in `test/helpers/fakeNina.js` is the afternoon
of the recording; `HOME` is a point of Alsdorf in a grid cell shared with
Baesweiler.
