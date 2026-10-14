// -----------------------------------------------------------------------------
// The integration against the SDK's fake Gladys and a fake warnung.bund.de.
// -----------------------------------------------------------------------------

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { NinaApp } from '../src/app.js';
import { ACTIONS, SCENE_ACTIONS, SCENE_TRIGGERS, WIDGETS } from '../src/constants.js';
import { createFakeTimers } from './helpers/fakeTimers.js';
import {
  AACHEN,
  ALSDORF_ID,
  FIXTURE_NOW,
  HOME,
  alsdorfItem,
  details,
  installNina,
  item,
} from './helpers/fakeNina.js';

const quiet = {
  info() {},
  warn: (...a) => process.env.DEBUG_TEST && console.error(...a),
  error() {},
  debug() {},
};

let fake;
afterEach(() => fake?.restore());

const HOUSE = 'ext:nina:house:home';
const PLACE = 'ext:nina:place:053340004004';
const houseDevice = (params = [{ name: 'ars', value: '053340004004' }]) => ({
  external_id: HOUSE,
  name: 'NINA Home',
  params,
});

async function setup({ config = {}, houses = [HOME], devices = [], nina = {} } = {}) {
  fake = installNina(nina);
  const gladys = createFakeGladys({ selector: 'nina', config, houses, devices });
  const timers = createFakeTimers();
  const clock = { now: FIXTURE_NOW };
  const sleeps = [];
  const app = new NinaApp({
    gladys,
    logger: quiet,
    now: () => clock.now,
    timers,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock.now += ms;
    },
  });
  gladys.onScanRequest(() => app.scan());
  gladys.onDeviceCreated((device) => app.deviceCreated(device));
  gladys.onDeviceDeleted((device) => app.deviceDeleted(device));
  gladys.onSceneAction(SCENE_ACTIONS.WARNINGS, (fields) => app.getWarnings(fields));
  gladys.onWidgetGet(WIDGETS.WARNINGS, (request) => app.getWidget(request));
  gladys.onAction(ACTIONS.TEST, () => app.testConnection());
  gladys.onAction(ACTIONS.SEARCH, (fields) => app.searchMunicipality(fields));
  await gladys.connect();
  return { app, gladys, timers, clock, sleeps };
}

/** Advance the clock by one poll and run it. */
async function poll({ timers, clock }, minutes = 5) {
  clock.now += minutes * 60_000;
  await timers.runIntervals();
}

test('discovery: each house in its municipality, then the typed ones', async () => {
  const baesweiler = {
    id: 2,
    name: 'Office',
    selector: 'office',
    latitude: 50.889,
    longitude: 6.1645,
  };
  const paris = { id: 3, name: 'Paris', selector: 'paris', latitude: 48.8566, longitude: 2.3522 };
  const unlocated = { id: 4, name: 'Boat', selector: 'boat', latitude: null, longitude: null };
  const config = { municipalities: 'Berlin, Atlantis' };
  const { app, gladys } = await setup({ config, houses: [HOME, baesweiler, paris, unlocated] });
  await app.start(config);
  const devices = gladys.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((d) => [
      d.name,
      d.external_id,
      d.params.find((p) => p.name === 'municipality').value,
    ]),
    [
      ['NINA Home', HOUSE, 'Alsdorf'],
      ['NINA Office', 'ext:nina:house:office', 'Baesweiler'],
      ['NINA Berlin', 'ext:nina:place:110000000000', 'Berlin'],
    ],
  );
  // The official way: the grid cell, then the outlines of its two municipalities.
  assert.equal(fake.count(/grid_zgem_mapping/), 1);
  assert.deepEqual(
    fake.calls.filter((c) => /polygons/.test(c.path)).map((c) => c.path.split('/').pop()),
    ['3251.geojson', '3252.geojson'],
    'Home is in the first outline; Office needs the second (cached)',
  );
  // No device created: nothing read, the status says what to do.
  assert.equal(fake.count(/dashboard/), 0);
  assert.match(gladys.fake.connectionStatus.message.fr, /Ouvrez Découverte/);
});

test('a created device: states, nothing fired on the first reading, a poll every 5 minutes', async () => {
  const { app, gladys, timers, clock } = await setup({ devices: [houseDevice()] });
  await app.start({});
  assert.equal(gladys.fake.lastState(`${HOUSE}:count`), 1);
  assert.equal(gladys.fake.lastState(`${HOUSE}:severity`), 1);
  assert.equal(gladys.fake.lastState(`${HOUSE}:headline`), 'Nuisance olfactive');
  assert.equal(gladys.fake.sceneEvents.length, 0, 'nothing on the first reading');
  assert.match(gladys.fake.connectionStatus.message.en, /Watching 1 place through NINA: 1 warning/);
  assert.equal(timers.intervals()[0].ms, 5 * 60_000);
  assert.equal(fake.count(/dashboard\/053340000000/), 1);
  assert.equal(fake.count(/warnings\//), 1);

  // Nothing new: a conditional GET answered 304, the details are not read again.
  await poll({ timers, clock });
  const conditional = fake.calls.filter((c) => /dashboard/.test(c.path)).at(-1);
  assert.ok(conditional.headers['If-None-Match']);
  assert.equal(fake.count(/warnings\//), 1);
  assert.equal(gladys.fake.sceneEvents.length, 0);

  // A severe warning for Alsdorf, and one for Baesweiler only.
  fake.state.dashboards[AACHEN] = [
    alsdorfItem(),
    item({ id: 'mow.severe', severity: 'Severe', titles: { de: 'Großbrand - Alsdorf' } }),
    item({ id: 'mow.other', severity: 'Extreme', area: { type: 'ZGEM', data: '3252,100001' } }),
  ];
  fake.state.details['mow.severe'] = details({ id: 'mow.severe', headline: 'Großbrand - Alsdorf' });
  const refreshes = gladys.fake.widgetRefreshes.length;
  await poll({ timers, clock });
  const issued = gladys.fake.sceneEvents.filter((e) => e.key === SCENE_TRIGGERS.ISSUED);
  assert.deepEqual(
    issued.map((e) => [e.data.id, e.data.min_severity]),
    [
      ['mow.severe', 'minor'],
      ['mow.severe', 'moderate'],
      ['mow.severe', 'severe'],
    ],
  );
  assert.equal(issued[2].data.house, HOUSE);
  assert.equal(issued[2].data.title, 'Großbrand - Alsdorf', 'no French title: German');
  assert.equal(issued[2].data.description, 'Beschreibung\nZweite Zeile');
  assert.equal(issued[2].data.place, 'Alsdorf');
  assert.equal(gladys.fake.lastState(`${HOUSE}:count`), 2);
  assert.equal(gladys.fake.lastState(`${HOUSE}:severity`), 3);
  assert.equal(gladys.fake.lastState(`${HOUSE}:headline`), 'Großbrand - Alsdorf');
  assert.ok(gladys.fake.widgetRefreshes.length > refreshes);
  assert.equal(fake.count(/warnings\/mow\.other/), 0, 'not for Alsdorf: never read');
  app.stop();
});

test('an all-clear ends the warning', async () => {
  const { app, gladys, timers, clock } = await setup({ devices: [houseDevice()] });
  await app.start({});
  const cancelId = 'mow.DE-NW-AC-SE090-20261014-90-001';
  fake.state.dashboards[AACHEN] = [
    item({
      id: cancelId,
      msgType: 'Cancel',
      severity: 'Minor',
      titles: { de: 'Entwarnung: Geruchsbelästigung' },
    }),
  ];
  fake.state.details[cancelId] = details({
    id: cancelId,
    msgType: 'Cancel',
    references: `DE-NW-AC-SE090,${ALSDORF_ID},2026-10-14T09:42:13-00:00`,
  });
  await poll({ timers, clock });
  assert.deepEqual(
    gladys.fake.sceneEvents.map((e) => [e.key, e.data.id, e.data.reason, e.data.min_severity]),
    [[SCENE_TRIGGERS.ENDED, ALSDORF_ID, 'all_clear', 'minor']],
  );
  assert.equal(gladys.fake.lastState(`${HOUSE}:count`), 0);
  assert.equal(gladys.fake.lastState(`${HOUSE}:headline`), '—');
  const widget = (await gladys.fake.widgetGet(WIDGETS.WARNINGS, { settings: { house: HOUSE } }))
    .data.content;
  assert.deepEqual(validateWidgetContent(widget), []);
  const cards = widget.components.find((c) => c.type === 'card-list');
  assert.equal(cards.items[0].badge.text, 'All clear');
  const tile = widget.components.find((c) => c.type === 'value');
  assert.deepEqual([tile.value, tile.icon, tile.color], [0, 'check-circle', 'success']);
  app.stop();
});

test('GRID warnings: the grid file is read once, for the municipality', async () => {
  const dwd = item({
    id: 'dwd.storm',
    provider: 'DWD',
    severity: 'Severe',
    area: { type: 'GRID', data: '255640+3,500001' },
    titles: { de: 'Unwetterwarnung vor Orkanböen', en: 'Severe weather warning' },
  });
  const far = item({ id: 'dwd.far', provider: 'DWD', area: { type: 'GRID', data: '1+10,500001' } });
  const { app, gladys, timers, clock } = await setup({
    houses: [],
    devices: [{ external_id: PLACE, name: 'NINA Alsdorf' }],
    nina: { dashboards: { [AACHEN]: [alsdorfItem(), dwd, far] } },
  });
  await app.start({ municipalities: 'Alsdorf' });
  assert.equal(fake.count(/grid_zgem_mapping/), 1);
  assert.equal(gladys.fake.lastState(`${PLACE}:count`), 2);
  assert.equal(gladys.fake.lastState(`${PLACE}:severity`), 3);
  assert.equal(gladys.fake.lastState(`${PLACE}:headline`), 'Unwetterwarnung vor Orkanböen');
  await poll({ timers, clock });
  assert.equal(fake.count(/grid_zgem_mapping/), 1, 'kept in memory');
  // The DWD warnings left out: the source filter of the configuration.
  await app.start({ municipalities: 'Alsdorf', sources: ['weather'] });
  assert.equal(gladys.fake.lastState(`${PLACE}:count`), 1);
  assert.equal(gladys.fake.sceneEvents.length, 0, 'a source filtered out is not "ended"');
  app.stop();
});

test('the scene action and the widget', async () => {
  const { app, gladys } = await setup({ devices: [houseDevice()] });
  await app.start({ language: 'en' });
  const result = await gladys.fake.sceneAction(SCENE_ACTIONS.WARNINGS, { house: HOUSE });
  assert.equal(result.success, true);
  assert.deepEqual(result.data.outputs, {
    place: 'Alsdorf',
    count: 1,
    highest_severity: 1,
    highest_severity_name: 'minor',
    titles: 'Odour nuisance (minor, MoWaS)',
    summary: '1 warning in force for Alsdorf: Odour nuisance (minor, MoWaS).',
  });
  assert.equal(gladys.fake.sceneEvents.length, 0, 'no event from an action');
  const wrong = await gladys.fake.sceneAction(SCENE_ACTIONS.WARNINGS, { house: 'ext:nina:nope' });
  assert.equal(wrong.success, false);
  const widget = (
    await gladys.fake.widgetGet(WIDGETS.WARNINGS, { settings: { house: HOUSE }, language: 'fr' })
  ).data.content;
  assert.deepEqual(validateWidgetContent(widget), []);
  assert.equal(widget.components[0].text, 'NINA Home');
  const cards = widget.components.find((c) => c.type === 'card-list');
  assert.equal(cards.items[0].title, 'Nuisance olfactive');
  const tile = widget.components.find((c) => c.type === 'value');
  assert.deepEqual([tile.value, tile.label, tile.color], [1, 'Avertissement en cours', 'info']);
  const none = (await gladys.fake.widgetGet(WIDGETS.WARNINGS, { settings: {} })).data.content;
  assert.match(none.components[0].text.en, /Pick the NINA device/);
});

test('the scene action reads now when the loop has not run yet', async () => {
  const { app, gladys } = await setup({ devices: [houseDevice()] });
  await app.prepare();
  const result = await gladys.fake.sceneAction(SCENE_ACTIONS.WARNINGS, { house: HOUSE });
  assert.equal(result.data.outputs.count, 1);
  assert.match(
    result.data.outputs.summary,
    /^1 avertissement en cours pour Alsdorf : Nuisance olfactive/,
  );
});

test('the buttons', async () => {
  const config = { municipalities: 'Neuenkirchen, Berlin' };
  const { app, gladys } = await setup({ config });
  await app.start(config);
  const tested = (await gladys.fake.action(ACTIONS.TEST)).data.message;
  assert.match(tested.en, /NINA answers: 18 municipalities known\./);
  assert.match(
    tested.en,
    /Home → Alsdorf \(Städteregion Aachen\) – 053340004004: 1 warning in force\./,
  );
  assert.match(tested.en, /Berlin → Berlin – 110000000000: 0 warnings in force\./);
  assert.match(tested.fr, /Plusieurs communes s'appellent « Neuenkirchen »/);
  const found = (await gladys.fake.action(ACTIONS.SEARCH, { query: 'neuen' })).data.message;
  assert.equal(
    found.en,
    'Neuenkirchen (Osnabrück) – 034595404027\nNeuenkirchen (Diepholz) – 032515406028',
  );
  const nothing = (await gladys.fake.action(ACTIONS.SEARCH, { query: 'zzz' })).data.message;
  assert.match(nothing.fr, /Aucune commune ne contient « zzz »/);
});

test('NINA down: the status says so, the loop keeps going and recovers', async () => {
  const { app, gladys, timers, clock } = await setup({ devices: [houseDevice()] });
  fake.state.down = true;
  await app.start({});
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /NINA \(warnung\.bund\.de\) is unreachable/,
  );
  assert.equal(timers.intervals().length, 1);
  fake.state.down = false;
  await poll({ timers, clock });
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(gladys.fake.discoveredDevices.length, 1, 'Discovery published once NINA is back');
  assert.equal(gladys.fake.lastState(`${HOUSE}:count`), 1);
  assert.equal(gladys.fake.sceneEvents.length, 0, 'the first good reading fires nothing');
  app.stop();
});

test('a house outside Germany, then houses that cannot be read', async () => {
  const paris = { id: 3, name: 'Paris', selector: 'paris', latitude: 48.8566, longitude: 2.3522 };
  const { app, gladys } = await setup({ houses: [paris] });
  await app.start({});
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /House "Paris" is not in a German municipality/,
  );
  gladys.getHouses = async () => {
    throw new Error('403 location not granted');
  };
  await app.start({});
  assert.match(
    gladys.fake.connectionStatus.message.fr,
    /L'emplacement des maisons n'est pas disponible/,
  );
});

test('a house device keeps its municipality when the house cannot be located again', async () => {
  const { app, gladys } = await setup({ houses: [], devices: [houseDevice()] });
  await app.start({});
  assert.equal(gladys.fake.lastState(`${HOUSE}:count`), 1, 'read from the ARS of its params');
});

test('polite: one request at a time, a second apart, nothing else in the background', async () => {
  const { app, timers, clock, sleeps } = await setup({ devices: [houseDevice()] });
  await app.start({});
  const first = fake.calls.length;
  assert.deepEqual(
    fake.calls.map((c) => c.path.split('/').slice(-2).join('/')),
    [
      'json/converted_gemeinden.json',
      'json/converted_kreise.json',
      'json/grid_zgem_mapping.json',
      'gemeinden_polygons/3251.geojson',
      'dashboard/053340000000.json',
      `warnings/${ALSDORF_ID}.json`,
    ],
  );
  assert.ok(sleeps.length >= first - 1 && sleeps.every((ms) => ms <= 1000));
  await poll({ timers, clock });
  assert.equal(fake.calls.length, first + 1, 'a poll: the dashboard only');
  await poll({ timers, clock }, 24 * 60);
  assert.equal(fake.count(/converted_gemeinden/), 2, 'the municipality list once a day');
});
