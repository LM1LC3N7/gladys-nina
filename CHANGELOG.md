# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [0.1.2] - 2026-10-14

### Added

- The widget shows the status at a glance: a green check when no warning is in
  force, else the number of warnings with an exclamation mark, in the colour of
  the most severe one.

### Fixed

- A line of the "Search a municipality" answer, pasted whole in "Municipalities
  to watch" (`Sandhausen (Rhein-Neckar-Kreis) – 082260076076`), is understood:
  only the ARS alone used to work.
- Docs: the scene variables are written as Gladys reads them,
  `{{triggerEvent.data.<key>}}`, and the action outputs come from the variable
  list.

## [0.1.1] - 2026-10-14

### Added

- One device per house located in Germany, in its municipality (found from
  the coordinates the way the official NINA web app does: its grid of Germany,
  then the outline of the municipalities): number of warnings in force,
  highest severity (0 to 4) and title of the most severe warning.
- Optional devices for typed municipalities (name, "Name (District)" or ARS)
  or whole districts.
- The warnings of every NINA source (MoWaS, KATWARN, BIWAPP, DWD, flood
  portal, police), filtered for the municipality like the official app, with
  a "Sources to keep" option.
- Scene triggers "NINA warning issued" (minimum severity, source) and "NINA
  warning ended" (all clear, expired, withdrawn): one event per warning and
  severity reached, a new version of a warning is not a new warning.
- Scene action "NINA warnings": count, highest severity, titles, summary.
- Dashboard widget "NINA warnings" with the official texts, the link to
  warnung.bund.de and the all-clears.
- "Test NINA" and "Search a municipality" buttons.

[Unreleased]: https://github.com/LM1LC3N7/gladys-nina/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/LM1LC3N7/gladys-nina/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/LM1LC3N7/gladys-nina/releases/tag/v0.1.1
