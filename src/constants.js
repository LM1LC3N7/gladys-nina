// -----------------------------------------------------------------------------
// Constants of the NINA integration.
// -----------------------------------------------------------------------------

/** The public NINA API of the BBK (https://nina.api.bund.dev). */
export const NINA_API = 'https://warnung.bund.de/api31';
/**
 * The files the official web app (warnung.bund.de) reads to turn a place into
 * a municipality: the municipality list (with its ARS), the district names,
 * the grid cell -> municipalities mapping and one polygon per municipality.
 */
export const NINA_ASSETS = 'https://warnung.bund.de/assets/json';
/** The official page of a warning: what the user opens to check it. */
export const WARNING_PAGE = 'https://warnung.bund.de/meldung';

/** Sent with every request: the BBK can see who we are. */
export const USER_AGENT = 'gladys-nina/0.1 (+https://github.com/LM1LC3N7/gladys-nina)';
export const HTTP_TIMEOUT = 15_000;

/**
 * The grid of the official web app (its assets/json/config.json): Germany cut
 * in cells of 0.015° of longitude by 0.01° of latitude, numbered from 1 in the
 * north-west corner, row by row. A warning of type GRID names cells.
 */
export const GRID = {
  minX: 5.86,
  maxX: 15.055,
  minY: 47.27,
  maxY: 55.06,
  lengthX: 0.015,
  lengthY: 0.01,
  countX: 613,
};

/** The municipality files change a few times a year: keep them a day. */
export const DIRECTORY_TTL = 24 * 60 * 60_000;
/** The grid file is re-read for a new place at most this often. */
export const GRID_RETRY = 10 * 60_000;
/** Between two requests of one refresh (dashboards, details, polygons). */
export const REQUEST_SPACING = 1_000;
/** Poll interval (minutes): default, minimum and maximum. */
export const POLL = { default: 5, min: 2, max: 60 };
/** States re-sent unchanged after this long, so a calm value stays dated. */
export const STATE_HEARTBEAT = 60 * 60_000;
/**
 * A warning missing from this many successful readings in a row (without an
 * all-clear nor an expiry to explain it) has been withdrawn. One reading is
 * not enough: a dashboard served empty once must not end and re-issue it.
 */
export const MISSING_READINGS = 2;
/**
 * A house in none of the simplified municipality polygons (a gap between two
 * of them) belongs to the nearest one when it is at most this far (km).
 */
export const SNAP_KM = 1.5;
/** At most this many typed municipalities. */
export const MAX_PLACES = 10;

/** Text bounds: Gladys text states, scene event strings (1000 at most). */
export const LIMITS = { state: 200, title: 200, headline: 300, text: 1000 };

/** CAP severities, levels 1 to 4 (0 is "no warning"). Keys forever. */
export const SEVERITIES = ['minor', 'moderate', 'severe', 'extreme'];

/**
 * The sources a user can keep or filter, as the official app groups them:
 * civil protection (MoWaS, KATWARN, BIWAPP), weather (DWD), flood (LHP),
 * police. Keys forever.
 */
export const SOURCES = {
  civil_protection: ['MOWAS', 'KATWARN', 'BIWAPP'],
  weather: ['DWD'],
  flood: ['LHP'],
  police: ['POLICE'],
};
export const SOURCE_KEYS = Object.keys(SOURCES);

/** Why a warning ended (the `reason` of warning_ended). Keys forever. */
export const END_REASONS = { ALL_CLEAR: 'all_clear', EXPIRED: 'expired', CANCELLED: 'cancelled' };

/** Languages of the warning texts in the states and the scene variables. */
export const LANGUAGES = ['fr', 'en', 'de'];

/** Manifest keys (forever: stored in user scenes and dashboards). */
export const ACTIONS = { TEST: 'test_connection', SEARCH: 'search_municipality' };
export const SCENE_ACTIONS = { WARNINGS: 'get_warnings' };
export const SCENE_TRIGGERS = { ISSUED: 'warning_issued', ENDED: 'warning_ended' };
export const WIDGETS = { WARNINGS: 'warnings' };
