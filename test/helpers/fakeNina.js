// -----------------------------------------------------------------------------
// A fake warnung.bund.de for the tests: the municipality files, the polygons,
// the district dashboards (with their ETag) and the warning details, served
// from test/fixtures and from a state the tests edit. Records every call and
// fails loudly on an unexpected URL: no test touches the network.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { setFetch } from '../../src/http.js';

setFetch(async (url) => {
  throw new Error(`Network call without a fake NINA in a test: ${url}`);
});

const read = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
export const fixture = (name) => JSON.parse(read(name));

/** 2026-10-14 17:00 in Germany: the afternoon of the recordings. */
export const FIXTURE_NOW = Date.parse('2026-10-14T15:00:00Z');

/** A house in Alsdorf (Städteregion Aachen), in a grid cell shared with Baesweiler. */
export const HOME = { id: 1, name: 'Home', selector: 'home', latitude: 50.885, longitude: 6.1645 };

export const ALSDORF_ID = 'mow.DE-NW-AC-SE090-20261014-90-000';
export const AACHEN = '053340000000';

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

/** A copy of the recorded Alsdorf dashboard item, edited by `edit`. */
export function alsdorfItem(edit = () => {}) {
  const item = structuredClone(fixture('dashboard-aachen.json')[0]);
  edit(item);
  return item;
}

/**
 * A dashboard item shaped after the recorded ones: { id, provider, severity,
 * msgType, area, titles, sent }.
 */
export function item({
  id,
  provider = 'MOWAS',
  severity = 'Severe',
  msgType = 'Alert',
  area = { type: 'ZGEM', data: '3251,100001' },
  titles = { de: `Warnung ${id}`, en: `Warning ${id}` },
  sent = '2026-10-14T16:30:00+02:00',
  version = 21,
  hash = 'h1',
}) {
  return {
    id,
    payload: {
      version,
      type: 'ALERT',
      id,
      hash,
      data: { headline: titles.de, provider, severity, msgType, area, valid: true },
    },
    i18nTitle: titles,
    sent,
  };
}

/** CAP details shaped after the recorded ones (German block only). */
export function details({ id, msgType = 'Alert', references, expires, headline, description }) {
  return {
    identifier: id,
    sender: 'DE-NW-AC-SE090',
    sent: '2026-10-14T16:30:00+02:00',
    status: 'Actual',
    msgType,
    scope: 'Public',
    ...(references ? { references } : {}),
    info: [
      {
        language: 'de',
        headline: headline ?? `Warnung ${id}`,
        description: description ?? 'Beschreibung<br/>Zweite Zeile',
        instruction: 'Fenster und Türen schließen.',
        severity: 'Severe',
        ...(expires ? { expires } : {}),
        area: [{ areaDesc: 'Alsdorf' }],
      },
    ],
  };
}

/**
 * Install the fake NINA. `state.dashboards` maps a district ARS to its items,
 * `state.details` a warning id to its details; both can change between polls.
 */
export function installNina({ dashboards = {}, details: detailsById = {}, down = false } = {}) {
  const state = {
    down,
    dashboards: { [AACHEN]: fixture('dashboard-aachen.json'), ...dashboards },
    details: { [ALSDORF_ID]: fixture('warning-alsdorf.json'), ...detailsById },
  };
  const calls = [];
  const etagOf = (body) => `"${JSON.stringify(body).length}-${JSON.stringify(body).slice(-24)}"`;
  const previous = setFetch(async (url, init = {}) => {
    const path = new URL(url).pathname;
    calls.push({ url, path, headers: init.headers ?? {} });
    if (state.down) {
      throw new TypeError('fetch failed');
    }
    let match;
    if (path === '/assets/json/converted_gemeinden.json') {
      return json(fixture('municipalities.json'));
    }
    if (path === '/assets/json/converted_kreise.json') {
      return json(fixture('districts.json'));
    }
    if (path === '/assets/json/grid_zgem_mapping.json') {
      return new Response(read('grid.json'), { headers: { 'content-type': 'application/json' } });
    }
    if ((match = /^\/assets\/json\/gemeinden_polygons\/(\d+)\.geojson$/.exec(path))) {
      try {
        return json(fixture(`polygons/${match[1]}.geojson`));
      } catch {
        return new Response('not found', { status: 404 });
      }
    }
    if ((match = /^\/api31\/dashboard\/(\d{12})\.json$/.exec(path))) {
      if (!(match[1] in state.dashboards) && match[1].endsWith('0000000') === false) {
        return new Response('', { status: 404 });
      }
      const body = state.dashboards[match[1]] ?? [];
      const etag = etagOf(body);
      if (init.headers?.['If-None-Match'] === etag) {
        return new Response(null, { status: 304, headers: { etag } });
      }
      return json(body, 200, { etag });
    }
    if ((match = /^\/api31\/warnings\/(.+)\.json$/.exec(path))) {
      const id = decodeURIComponent(match[1]);
      return id in state.details ? json(state.details[id]) : new Response('', { status: 404 });
    }
    throw new Error(`Unexpected network call in a test: ${url}`);
  });
  return {
    calls,
    state,
    count: (pattern) => calls.filter((c) => pattern.test(c.path)).length,
    restore: () => setFetch(previous),
  };
}
