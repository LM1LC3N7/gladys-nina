// -----------------------------------------------------------------------------
// The configuration the user fills (manifest `config_schema`), normalized.
// -----------------------------------------------------------------------------

import { LANGUAGES, MAX_PLACES, POLL, SOURCE_KEYS } from './constants.js';

// Defaults: they MUST match the `default` values of the manifest.
export const DEFAULTS = {
  municipalities: '',
  sources: [...SOURCE_KEYS],
  language: 'fr',
  poll_interval: POLL.default,
};

const number = (value, fallback, min, max) => {
  const n = value === '' || value === null || value === undefined ? Number.NaN : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

/**
 * The sources to keep: the multi_select array, or a text ("weather, flood"
 * or a JSON array). Nothing checked means all of them: a warning integration
 * that keeps nothing would be worse than useless.
 */
export function parseSources(value) {
  let list = value;
  if (typeof value === 'string') {
    try {
      list = JSON.parse(value);
    } catch {
      list = value.split(',');
    }
  }
  const wanted = new Set((Array.isArray(list) ? list : []).map((s) => String(s).trim()));
  const sources = SOURCE_KEYS.filter((s) => wanted.has(s));
  return sources.length > 0 ? sources : [...SOURCE_KEYS];
}

/** The typed municipalities: names or ARS, separated by commas, semicolons or lines. */
export function parseMunicipalities(value) {
  const seen = new Set();
  const list = [];
  for (const entry of String(value ?? '').split(/[,;\n]/)) {
    const text = entry.trim();
    if (text && !seen.has(text.toLowerCase())) {
      seen.add(text.toLowerCase());
      list.push(text);
    }
  }
  return {
    municipalities: list.slice(0, MAX_PLACES),
    dropped: Math.max(0, list.length - MAX_PLACES),
  };
}

export function normalizeConfig(raw = {}) {
  const language = String(raw.language ?? DEFAULTS.language).toLowerCase();
  const { municipalities, dropped } = parseMunicipalities(raw.municipalities);
  return {
    municipalities,
    droppedMunicipalities: dropped,
    sources: parseSources(raw.sources ?? DEFAULTS.sources),
    language: LANGUAGES.includes(language) ? language : DEFAULTS.language,
    pollInterval: number(raw.poll_interval, DEFAULTS.poll_interval, POLL.min, POLL.max),
  };
}
