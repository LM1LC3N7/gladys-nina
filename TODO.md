# TODO

## Before announcing

- [ ] Test on a real Gladys 5.1+ with a house located in Germany: discovery
      (the municipality found), the widget, the two triggers in the scene
      editor (minimum severity required, source and reason left empty), the
      scene action in a message.
- [ ] Watch a real warning day (a storm with DWD warnings, a flood) to see
      GRID items and LHP / police messages in a dashboard.
- [ ] Turn on "Private vulnerability reporting" (SECURITY.md points there).
- [ ] Add the `gladys-assistant-integration` topic to publish in the store.

## To confirm (built from the official app's code, not seen live)

- [ ] **GRID areas**: only `ZGEM` items were in the dashboards on 2026-10-14.
      The GRID matching follows `isAreaInGrid` of warnung.bund.de/js/app.js
      (ranges of cells, through `grid_zgem_mapping.json`); check it on a DWD
      or LHP warning.
- [ ] The **DWD, LHP and police items**: their `provider` value ("DWD",
      "LHP", "POLICE" in the app's code), their id prefixes, whether their
      updates carry CAP `references` (a DWD update gets a new identifier: the
      trigger would then see a new warning) and whether `i18nTitle` holds
      more than German.
- [ ] `payload.version` looks like a global data version (19 to 21 on every
      item), not a revision of the warning: the revision is `version` +
      `hash`; check that an update changes the hash.
- [ ] The **Warntag** (national warning day test, second Thursday of
      September): are the test messages `status: "Actual"`? They would fire
      the triggers like a real warning (as the NINA app rings).
- [ ] The `risk` feature category renders well in the device and dashboard
      cards (chosen for the 0-4 severity).
- [ ] The link `https://warnung.bund.de/meldung/<id>/<headline>` (the RSS
      feeds' form) opens the warning in the web app, also after its end.

## Choices made (the spec left them open)

- A house becomes a municipality from its coordinates, like the official app
  (grid cell, then outlines); municipalities or districts can also be typed
  (name, "Name (District)", ARS, district code) as extra devices.
- Matching per municipality (the app's ZGEM/GRID filter), not per point in
  the warning polygons: the same answer as the NINA app for the place, one
  request per district.
- An item without area or with an unknown area type counts district-wide; a
  severity "Unknown" counts as minor; CAP `status` other than "Actual" is
  ignored.
- `warning_issued` / `warning_ended`: required minimum severity (one event
  per severity mark reached, matched by equality), optional source (empty =
  any) rather than an "any" option, which equality matching cannot express.
- A warning is "withdrawn" (`cancelled`) after 2 readings without it and
  without an all-clear or an expiry.
- Default language of the titles: French (the Gladys community), with
  English and German.

## Ideas

- The instructions of a warning as a separate text feature for a TTS scene.
- Recent all-clears as a scene variable of `warning_ended` ("Die Warnung ist
  aufgehoben" text).
- The `de-LS` (easy German) block as an option.
- Covid-era endpoints and the archive (`/archive.mowas/`) are left out on
  purpose.
