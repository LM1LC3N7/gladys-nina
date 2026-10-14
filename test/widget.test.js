import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { FEATURE, buildPlaceDevice, parseExternalId, placeStates } from '../src/devices.js';
import { placeReading, warningOf } from '../src/model.js';
import { buildDirectory, resolvePlace } from '../src/places.js';
import { warningsWidget } from '../src/widget.js';
import { FIXTURE_NOW, fixture, item } from './helpers/fakeNina.js';

const alsdorfPlace = () =>
  resolvePlace(buildDirectory(fixture('municipalities.json'), fixture('districts.json')), 'Alsdorf')
    .place;
const alsdorf = () =>
  warningOf(fixture('dashboard-aachen.json')[0], fixture('warning-alsdorf.json'));

test('a house device and its states', () => {
  const gladys = createFakeGladys({ selector: 'nina' });
  const device = buildPlaceDevice(gladys, {
    kind: 'house',
    selector: 'home',
    houseName: 'Home',
    place: alsdorfPlace(),
  });
  assert.equal(device.external_id, 'ext:nina:house:home');
  assert.equal(device.name, 'NINA Home');
  assert.deepEqual(
    device.features.map((f) => [f.external_id, f.category, f.type]),
    [
      ['ext:nina:house:home:count', 'counter-sensor', 'integer'],
      ['ext:nina:house:home:severity', 'risk', 'integer'],
      ['ext:nina:house:home:headline', 'text', 'text'],
    ],
  );
  assert.deepEqual(Object.fromEntries(device.params.map((p) => [p.name, p.value])), {
    ars: '053340004004',
    municipality: 'Alsdorf',
    district: 'Städteregion Aachen',
    house: 'home',
  });
  assert.deepEqual(parseExternalId(device.external_id), { kind: 'house', selector: 'home' });
  assert.deepEqual(parseExternalId('ext:nina:place:110000000000'), {
    kind: 'place',
    ars: '110000000000',
  });
  assert.equal(parseExternalId('ext:nina:place:berlin'), undefined);
  const states = placeStates(device.external_id, placeReading([alsdorf()], FIXTURE_NOW), 'en');
  assert.deepEqual(
    states.map((s) => s.state ?? s.text),
    [1, 1, 'Odour nuisance'],
  );
  const calm = placeStates(device.external_id, placeReading([], FIXTURE_NOW), 'en');
  assert.deepEqual(
    calm.map((s) => s.state ?? s.text),
    [0, 0, '—'],
  );
  assert.equal(states[0].device_feature_external_id, `${device.external_id}:${FEATURE.COUNT}`);
});

test('the widget: warnings first, the all-clears after, the reminder always', () => {
  const reading = placeReading(
    [
      alsdorf(),
      warningOf(item({ id: 'x', severity: 'Extreme', titles: { de: 'Hochwasser', fr: 'Crue' } })),
      warningOf(item({ id: 'y', msgType: 'Cancel', severity: 'Minor' })),
    ],
    FIXTURE_NOW,
  );
  const content = warningsWidget({
    name: 'NINA Home',
    placeName: 'Alsdorf',
    reading,
    language: 'fr',
  });
  assert.deepEqual(validateWidgetContent(content), []);
  const [heading, tile, list, body] = content.components;
  assert.equal(heading.text, 'NINA Home');
  // The status at a glance: the count, an exclamation mark, the colour of the worst.
  assert.deepEqual(
    [tile.type, tile.value, tile.label, tile.icon, tile.color],
    ['value', 2, 'Avertissements en cours', 'alert-circle', 'danger'],
  );
  assert.deepEqual(
    list.items.map((i) => [i.title, i.badge.text, i.badge.color]),
    [
      ['Crue', 'Extrême', 'danger'],
      ['Nuisance olfactive', 'Mineur', 'info'],
      ['Warnung y', 'Fin d’alerte', 'success'],
    ],
  );
  assert.equal(list.items[1].subtitle, 'Protection civile · MoWaS · Alsdorf - Mariadorf');
  assert.equal(list.items[1].date, '2026-10-14T11:42:13+02:00');
  assert.match(list.items[1].description, /^Geruchsbelästigung - Alsdorf - Mariadorf\n\nDurch ein/);
  assert.match(list.items[1].description, /Texte original en allemand, inchangé\. Source : BBK/);
  assert.match(list.items[1].links[0].url, /^https:\/\/warnung\.bund\.de\/meldung\/mow\./);
  assert.match(body.text, /Pas un système de sécurité.*application NINA, sirènes, radio/);
  assert.equal(content.ttl_seconds, 60);
});

test('the widget when calm, and before the first reading', () => {
  const calm = warningsWidget({
    name: 'NINA Home',
    placeName: 'Alsdorf',
    reading: placeReading([], FIXTURE_NOW),
    language: 'en',
  });
  assert.deepEqual(validateWidgetContent(calm), []);
  assert.equal(calm.components.length, 3);
  const [, tile, body] = calm.components;
  assert.deepEqual(
    [tile.value, tile.label, tile.icon, tile.color],
    [0, 'No warning in force', 'check-circle', 'success'],
  );
  assert.match(body.text, /^No warning in force for Alsdorf\.\nNot a safety system/);
  const waiting = warningsWidget({ name: 'NINA Home', reading: undefined });
  assert.deepEqual(validateWidgetContent(waiting), []);
  assert.equal(waiting.ttl_seconds, 30);
});

test('a very long official text is cut to the detail panel, the note kept', () => {
  const long = warningOf(item({ id: 'l' }), {
    ...fixture('warning-update-saarlouis.json'),
  });
  const content = warningsWidget({
    name: 'NINA Home',
    reading: placeReading([long], FIXTURE_NOW),
    language: 'en',
  });
  assert.deepEqual(validateWidgetContent(content), []);
  const list = content.components.find((c) => c.type === 'card-list');
  const { description } = list.items[0];
  assert.ok(description.length <= 2000);
  assert.match(description, /…\n\nOriginal text in German, unchanged\./);
});
