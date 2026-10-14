import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cut,
  htmlToText,
  isActive,
  placeReading,
  providerOf,
  severityLevel,
  sourceOf,
  titleOf,
  warningOf,
} from '../src/model.js';
import { normalizeConfig, parseSources } from '../src/config.js';
import { FIXTURE_NOW, details, fixture, item } from './helpers/fakeNina.js';

const alsdorf = () =>
  warningOf(fixture('dashboard-aachen.json')[0], fixture('warning-alsdorf.json'));

test('a recorded MoWaS warning becomes a plain warning', () => {
  const w = alsdorf();
  assert.equal(w.id, 'mow.DE-NW-AC-SE090-20261014-90-000');
  assert.equal(w.provider, 'MOWAS');
  assert.equal(w.providerName, 'MoWaS');
  assert.equal(w.source, 'civil_protection');
  assert.equal(w.msgType, 'alert');
  assert.equal(w.severity, 1);
  assert.equal(w.headline, 'Geruchsbelästigung - Alsdorf - Mariadorf');
  assert.deepEqual(w.titles, {
    de: 'Geruchsbelästigung - Alsdorf - Mariadorf',
    en: 'Odour nuisance',
    fr: 'Nuisance olfactive',
  });
  assert.match(w.description, /Brandrauch\.\nEs besteht keine akute Gesundheitsgefahr\.$/);
  assert.equal(
    w.instruction,
    'Es besteht keine Gefahr.\nSchließen Sie vorsorglich Fenster und Türen.',
  );
  assert.equal(w.area, 'Alsdorf - Mariadorf');
  assert.equal(w.sender, 'Integrierte Leitstelle Städteregion Aachen');
  assert.equal(w.sent, '2026-10-14T11:42:13+02:00');
  assert.equal(w.expires, null);
  assert.equal(
    w.link,
    'https://warnung.bund.de/meldung/mow.DE-NW-AC-SE090-20261014-90-000/Geruchsbel%C3%A4stigung_-_Alsdorf_-_Mariadorf',
  );
  assert.equal(isActive(w, FIXTURE_NOW), true);
});

test('titles: the own translation, else German', () => {
  const w = alsdorf();
  assert.equal(titleOf(w, 'fr'), 'Nuisance olfactive');
  assert.equal(titleOf(w, 'en'), 'Odour nuisance');
  assert.equal(titleOf(w, 'de'), 'Geruchsbelästigung - Alsdorf - Mariadorf');
  const dwd = warningOf(item({ id: 'dwd.1', provider: 'DWD', titles: { de: 'Sturmböen' } }));
  assert.equal(titleOf(dwd, 'fr'), 'Sturmböen');
  assert.equal(dwd.source, 'weather');
  assert.equal(dwd.detailed, false, 'no details: the dashboard alone');
});

test('an all-clear and an update carry their CAP references', () => {
  const cancel = warningOf(
    item({ id: 'mow.DE-NI-STD-SE029-20261014-29-001', msgType: 'Cancel', severity: 'Minor' }),
    fixture('warning-cancel-cappeln.json'),
  );
  assert.equal(cancel.msgType, 'cancel');
  assert.ok(cancel.references.includes('mow.DE-NI-STD-SE029-20261014-29-000'));
  assert.equal(isActive(cancel, FIXTURE_NOW), false);
  assert.match(cancel.description, /Dies ist die Entwarnung zur Warnung "Großbrand/);
  const update = warningOf(
    item({ id: 'mow.DE-SL-SLS-W038-20260904-000', msgType: 'Update' }),
    fixture('warning-update-saarlouis.json'),
  );
  assert.deepEqual(update.references, ['mow.DE-SL-SLS-W038-20260901-000']);
  assert.equal(update.web, 'https://twrs-gmbh.de/');
});

test('severities, providers and sources', () => {
  assert.deepEqual(
    ['Minor', 'Moderate', 'Severe', 'Extreme', 'Unknown', undefined].map(severityLevel),
    [1, 2, 3, 4, 1, 1],
  );
  assert.equal(providerOf({ id: 'kat.123' }), 'KATWARN');
  assert.equal(providerOf({ id: 'lhp.x', payload: { data: {} } }), 'LHP');
  assert.equal(providerOf({ id: 'x', payload: { data: { provider: 'police' } } }), 'POLICE');
  assert.equal(sourceOf('BIWAPP'), 'civil_protection');
  assert.equal(sourceOf('LHP'), 'flood');
  assert.equal(sourceOf('POLICE'), 'police');
});

test('HTML to text, and the bounds', () => {
  assert.equal(
    htmlToText('Il n&apos;y a pas de danger.<br/>&quot;A&quot; &amp; B&#8239;C <b>D</b>'),
    'Il n\'y a pas de danger.\n"A" & B C D',
  );
  assert.equal(htmlToText('a<br><br><br><br>b'), 'a\n\nb');
  assert.equal(cut('abcdef', 4), 'abc…');
  assert.equal(cut('abc', 4), 'abc');
});

test('in force: expiry, tests and invalid items are not', () => {
  const expiring = warningOf(
    item({ id: 'a' }),
    details({ id: 'a', expires: '2026-10-14T17:00:00+02:00' }),
  );
  assert.equal(isActive(expiring, FIXTURE_NOW - 60_000), true);
  assert.equal(isActive(expiring, FIXTURE_NOW), false);
  const exercise = warningOf(item({ id: 'b' }), { ...details({ id: 'b' }), status: 'Exercise' });
  assert.equal(isActive(exercise, FIXTURE_NOW), false);
  const invalid = item({ id: 'c' });
  invalid.payload.data.valid = false;
  assert.equal(isActive(warningOf(invalid), FIXTURE_NOW), false);
});

test('a reading: most severe first, the all-clears apart', () => {
  const reading = placeReading(
    [
      alsdorf(),
      warningOf(item({ id: 'x', severity: 'Extreme' })),
      warningOf(item({ id: 'y', msgType: 'Cancel' })),
      warningOf(
        item({ id: 'z', msgType: 'Cancel' }),
        details({ id: 'z', msgType: 'Cancel', expires: '2026-10-14T16:00:00+02:00' }),
      ),
    ],
    FIXTURE_NOW,
  );
  assert.equal(reading.count, 2);
  assert.equal(reading.highest, 4);
  assert.deepEqual(
    reading.active.map((w) => w.id),
    ['x', 'mow.DE-NW-AC-SE090-20261014-90-000'],
  );
  assert.deepEqual(
    reading.allClear.map((w) => w.id),
    ['y'],
  );
});

test('the configuration is normalized', () => {
  const config = normalizeConfig({
    municipalities: 'Alsdorf, alsdorf;Köln\n091620000000',
    sources: ['weather', 'bogus'],
    language: 'DE',
    poll_interval: 1,
  });
  assert.deepEqual(config.municipalities, ['Alsdorf', 'Köln', '091620000000']);
  assert.deepEqual(config.sources, ['weather']);
  assert.equal(config.language, 'de');
  assert.equal(config.pollInterval, 2, 'never below 2 minutes');
  assert.deepEqual(parseSources([]), ['civil_protection', 'weather', 'flood', 'police']);
  assert.deepEqual(parseSources('flood, police'), ['flood', 'police']);
  const many = normalizeConfig({
    municipalities: Array.from({ length: 12 }, (_, i) => `M${i}`).join(','),
  });
  assert.equal(many.municipalities.length, 10);
  assert.equal(many.droppedMunicipalities, 2);
  assert.equal(normalizeConfig({}).pollInterval, 5);
});
