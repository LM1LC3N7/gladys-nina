// -----------------------------------------------------------------------------
// Places: the municipality directory of the official web app, a typed name or
// ARS -> a place, coordinates -> a grid cell and a municipality, and the
// filter that tells whether a warning of the district concerns a place.
// Pure: works on the files the client downloaded.
//
// The official app (warnung.bund.de/js/app.js, read on 2026-10-14) works the
// same way: a district dashboard, then each item kept when its area names
// the municipality (`ZGEM`: municipality ids) or one of its grid cells
// (`GRID`: cell ids, through grid_zgem_mapping.json). Both lists are ranges
// "start+count" separated by commas ("3251,100001", "136849+2,500001").
// -----------------------------------------------------------------------------

import { GRID } from './constants.js';

/** Lowercase, no accents, no punctuation: "Würselen" -> "wurselen". */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "Landkreis Städteregion Aachen" -> "Städteregion Aachen": the name people use. */
export const shortDistrict = (name) => String(name ?? '').replace(/^Landkreis\s+/, '');

/** The district dashboard key of an ARS: 5 digits then "0000000". */
export const districtArsOf = (ars) => `${String(ars).slice(0, 5)}0000000`;

/**
 * The directory from the two files of the official app:
 *   { municipalities: Map(zid -> municipality), byArs: Map(ars -> municipality),
 *     districts: Map(code -> { code, name }) }
 * A municipality: { zid, ars, name, districtCode, districtName, lat, lng, population }.
 * A district-free city (KFS: Berlin, Hamburg, Köln...) has no name of its own
 * in the municipality file: the district file names it.
 */
export function buildDirectory(municipalities = {}, districts = {}) {
  const districtMap = new Map(
    Object.entries(districts ?? {}).map(([code, d]) => [code, { code, name: d?.NAME ?? code }]),
  );
  const byZid = new Map();
  const byArs = new Map();
  for (const [key, raw] of Object.entries(municipalities ?? {})) {
    const ars = String(raw?.RS ?? '');
    if (!/^\d{12}$/.test(ars)) {
      continue;
    }
    const districtCode = ars.slice(0, 5);
    const districtName = districtMap.get(districtCode)?.name ?? districtCode;
    const [lng, lat] = String(raw.PKT ?? '')
      .split(',')
      .map(Number);
    const municipality = {
      zid: Number(key),
      ars,
      name: raw.NAME || shortDistrict(districtName),
      districtCode,
      districtName: shortDistrict(districtName),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      population: Number(raw.EWZ) || 0,
    };
    byZid.set(municipality.zid, municipality);
    byArs.set(ars, municipality);
  }
  return { municipalities: byZid, byArs, districts: districtMap };
}

/** A municipality as a watched place. */
export const placeOfMunicipality = (m) => ({
  level: 'municipality',
  ars: m.ars,
  zid: m.zid,
  name: m.name,
  districtCode: m.districtCode,
  districtName: m.districtName,
  districtArs: districtArsOf(m.ars),
});

/** A whole district as a watched place: every warning of its dashboard counts. */
const placeOfDistrict = (d) => ({
  level: 'district',
  ars: `${d.code}0000000`,
  zid: null,
  name: shortDistrict(d.name),
  districtCode: d.code,
  districtName: shortDistrict(d.name),
  districtArs: `${d.code}0000000`,
});

const label = (m) =>
  fold(m.name) === fold(m.districtName) ? m.name : `${m.name} (${m.districtName})`;

/** "Alsdorf (Städteregion Aachen) – 053340004004": a search result. */
export const placeLine = (m) => `${label(m)} – ${m.ars}`;

/**
 * What the user typed -> a place:
 *   - 12 digits: an ARS (a municipality, or a whole district for "xxxxx0000000");
 *   - 5 digits: a district code;
 *   - a name, optionally "Name (District)" to pick among homonyms; a district
 *     name ("Landkreis Cloppenburg", "Cloppenburg") when no municipality has it.
 * Returns { place } or { error: 'unknown' | 'ambiguous', matches }.
 */
export function resolvePlace(directory, query) {
  const text = String(query ?? '').trim();
  if (!text) {
    return { error: 'unknown', matches: [] };
  }
  const digits = text.replace(/\s+/g, '');
  if (/^\d{12}$/.test(digits) || /^\d{5}$/.test(digits)) {
    const ars = digits.length === 5 ? `${digits}0000000` : digits;
    const municipality = directory.byArs.get(ars);
    if (municipality) {
      return { place: placeOfMunicipality(municipality) };
    }
    const district = ars.endsWith('0000000') && directory.districts.get(ars.slice(0, 5));
    return district ? { place: placeOfDistrict(district) } : { error: 'unknown', matches: [] };
  }
  // The whole text first ("Cappeln (Oldenburg)" is a name), then "Name (District)".
  const all = [...directory.municipalities.values()];
  let name = fold(text);
  let matches = all.filter((m) => fold(m.name) === name);
  const split = /^(.*)\(([^)]*)\)\s*$/.exec(text);
  if (matches.length === 0 && split) {
    name = fold(split[1]);
    const within = fold(split[2]);
    matches = all.filter((m) => fold(m.name) === name && fold(m.districtName).includes(within));
  }
  if (matches.length === 1) {
    return { place: placeOfMunicipality(matches[0]) };
  }
  if (matches.length > 1) {
    return { error: 'ambiguous', matches: matches.slice(0, 5).map(placeLine) };
  }
  const district = [...directory.districts.values()].find(
    (d) => fold(d.name) === name || fold(shortDistrict(d.name)) === name,
  );
  return district ? { place: placeOfDistrict(district) } : { error: 'unknown', matches: [] };
}

/** The municipalities whose name contains the text: exact first, then by population. */
export function searchPlaces(directory, query, max = 10) {
  const wanted = fold(query);
  if (!wanted) {
    return [];
  }
  const rank = (m) => {
    const name = fold(m.name);
    return name === wanted ? 0 : name.startsWith(wanted) ? 1 : 2;
  };
  return [...directory.municipalities.values()]
    .filter((m) => fold(m.name).includes(wanted) || m.ars === wanted)
    .sort((a, b) => rank(a) - rank(b) || b.population - a.population)
    .slice(0, max);
}

/** The grid cell of a point (the official app's formula), null outside the grid. */
export function gridCell(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lng < GRID.minX || lng > GRID.maxX || lat < GRID.minY || lat > GRID.maxY) {
    return null;
  }
  const column = Math.max(1, Math.ceil((lng - GRID.minX) / GRID.lengthX));
  const row = Math.max(1, Math.ceil((GRID.maxY - lat) / GRID.lengthY));
  return column + (row - 1) * GRID.countX;
}

/**
 * Scan the text of grid_zgem_mapping.json ({"cell":[zid,...],...}) for what
 * is needed only: the municipalities of some cells (to locate houses) and the
 * cells of some municipalities (to match GRID warnings). Two passes, so the
 * cells of the candidates found in the first one are collected too.
 */
export function scanGrid(text, { cells = [], zids = [] } = {}) {
  const wantedCells = new Set(cells.map(Number));
  const candidates = new Map();
  const entries = /"(\d+)"\s*:\s*\[([\d,\s]*)\]/g;
  const zidsOf = (list) =>
    list
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      .map(Number);
  let match;
  while ((match = entries.exec(text))) {
    const cell = Number(match[1]);
    if (wantedCells.has(cell)) {
      candidates.set(cell, zidsOf(match[2]));
    }
  }
  const wantedZids = new Set(zids.map(Number));
  for (const list of candidates.values()) {
    for (const zid of list) {
      wantedZids.add(zid);
    }
  }
  const cellsOf = new Map([...wantedZids].map((zid) => [zid, new Set()]));
  entries.lastIndex = 0;
  while ((match = entries.exec(text))) {
    for (const zid of zidsOf(match[2])) {
      cellsOf.get(zid)?.add(Number(match[1]));
    }
  }
  return { candidates, cellsOf };
}

// --- Polygons ------------------------------------------------------------------

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

const polygonsOf = (geometry) =>
  geometry?.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon'
      ? geometry.coordinates
      : [];

/** Is the point [lng, lat] inside a GeoJSON Polygon / MultiPolygon (holes excluded)? */
export function containsPoint(geometry, point) {
  return polygonsOf(geometry).some(
    ([outer, ...holes]) =>
      Array.isArray(outer) && inRing(point, outer) && !holes.some((h) => inRing(point, h)),
  );
}

/** Distance (km) from the point [lng, lat] to the outline of a geometry. */
export function distanceToOutlineKm(geometry, [lng, lat]) {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.57;
  let best = Infinity;
  for (const rings of polygonsOf(geometry)) {
    for (const ring of rings) {
      for (let i = 1; i < ring.length; i += 1) {
        const ax = (ring[i - 1][0] - lng) * kx;
        const ay = (ring[i - 1][1] - lat) * ky;
        const bx = (ring[i][0] - lng) * kx;
        const by = (ring[i][1] - lat) * ky;
        const dx = bx - ax;
        const dy = by - ay;
        const t =
          dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
      }
    }
  }
  return best;
}

// --- Does a warning concern a place? ---------------------------------------------

/** "3251,136849+2,500001" -> [[3251, 3251], [136849, 136851], [500001, 500001]]. */
export function parseRanges(data) {
  return String(data ?? '')
    .split(',')
    .map((part) => part.split('+').map((n) => Number.parseInt(n, 10)))
    .filter(([start]) => Number.isFinite(start))
    .map(([start, count]) => [start, start + (Number.isFinite(count) ? count : 0)]);
}

const inRanges = (value, ranges) => ranges.some(([a, b]) => value >= a && value <= b);

/**
 * Does a dashboard item concern the place? true / false, or null when the
 * item is a GRID one and the cells of the municipality are not known yet.
 * A whole district (no municipality) takes every item of its dashboard, like
 * the official app does for a district; an item without an area too (the
 * official app assumes every item has one: better a warning too many).
 */
export function concernsPlace(area, place, cellsOfZid) {
  if (place.level === 'district' || !area?.type) {
    return true;
  }
  const ranges = parseRanges(area.data);
  if (area.type === 'ZGEM') {
    return inRanges(place.zid, ranges);
  }
  if (area.type === 'GRID') {
    const cells = cellsOfZid?.get(place.zid);
    if (!cells) {
      return null;
    }
    for (const cell of cells) {
      if (inRanges(cell, ranges)) {
        return true;
      }
    }
    return false;
  }
  return true;
}
