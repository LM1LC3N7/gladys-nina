import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeReading, warningOf } from '../src/model.js';
import { sceneEvents, trackWarnings } from '../src/triggers.js';
import { FIXTURE_NOW, details, item } from './helpers/fakeNina.js';

const MINUTE = 60_000;
const warning = (options, cap) => warningOf(item(options), cap);
const reading = (warnings, now = FIXTURE_NOW) => placeReading(warnings, now);

/** Run readings in a row; returns the transitions of each step. */
function run(...readings) {
  let tracked;
  return readings.map((r, i) => {
    const result = trackWarnings(tracked, r, FIXTURE_NOW + i * 5 * MINUTE);
    tracked = result.tracked;
    return result.transitions;
  });
}

const summary = (transitions) =>
  transitions.map((t) => `${t.type}:${t.warning.id}:${t.reason ?? ''}:${t.levels.join('')}`);

test('the first reading fires nothing', () => {
  const [first] = run(reading([warning({ id: 'a', severity: 'Extreme' })]));
  assert.deepEqual(first, []);
});

test('a new warning: one event per minimum severity reached', () => {
  const [, second] = run(reading([]), reading([warning({ id: 'a', severity: 'Severe' })]));
  assert.deepEqual(summary(second), ['issued:a::123']);
  const events = sceneEvents(second, {
    deviceId: 'ext:nina:house:home',
    placeName: 'Alsdorf',
    language: 'fr',
    now: FIXTURE_NOW,
  });
  assert.deepEqual(
    events.map((e) => [e.key, e.data.min_severity]),
    [
      ['warning_issued', 'minor'],
      ['warning_issued', 'moderate'],
      ['warning_issued', 'severe'],
    ],
  );
  const { data } = events[2];
  assert.equal(data.house, 'ext:nina:house:home');
  assert.equal(data.source, 'civil_protection');
  assert.equal(data.severity, 3);
  assert.equal(data.severity_name, 'sévère');
  assert.equal(data.title, 'Warnung a', 'no French title: German');
  assert.equal(data.provider, 'MoWaS');
  assert.equal(data.place, 'Alsdorf');
  assert.ok(Object.keys(data).length <= 30);
  for (const value of Object.values(data)) {
    assert.ok(value === null || typeof value !== 'string' || value.length <= 1000);
  }
});

test('a new version is not a new warning, unless its severity rose', () => {
  const steps = run(
    reading([warning({ id: 'a', severity: 'Moderate' })]),
    reading([warning({ id: 'a', severity: 'Moderate', hash: 'h2' })]),
    reading([warning({ id: 'a', severity: 'Extreme', hash: 'h3' })]),
    reading([warning({ id: 'a', severity: 'Minor', hash: 'h4' })]),
    reading([warning({ id: 'a', severity: 'Severe', hash: 'h5' })]),
  );
  assert.deepEqual(steps.map(summary), [[], [], ['issued:a::34'], [], []]);
});

test('an update under a new id that references the old one keeps the identity', () => {
  const update = warning(
    { id: 'mow.B-001', severity: 'Moderate', msgType: 'Update' },
    details({ id: 'mow.B-001', references: 'DE-X,mow.A-000,2026-10-14T07:19:51-00:00' }),
  );
  const [, second, third] = run(
    reading([warning({ id: 'mow.A-000', severity: 'Moderate' })]),
    reading([update]),
    reading([]),
  );
  assert.deepEqual(second, [], 'no new warning, no end of the old one');
  assert.deepEqual(third, [], 'missing once: not ended yet');
});

test('an all-clear ends the warning at once, once per severity reached', () => {
  const cancel = warning(
    { id: 'mow.A-001', msgType: 'Cancel', severity: 'Minor' },
    details({
      id: 'mow.A-001',
      msgType: 'Cancel',
      references: 'DE-X,mow.A-000,2026-10-14T07:19:51-00:00',
    }),
  );
  const [, second] = run(
    reading([warning({ id: 'mow.A-000', severity: 'Moderate' })]),
    reading([cancel]),
  );
  assert.deepEqual(summary(second), ['ended:mow.A-000:all_clear:12']);
  const events = sceneEvents(second, {
    deviceId: 'd',
    placeName: 'P',
    language: 'en',
    now: FIXTURE_NOW,
  });
  assert.deepEqual(
    events.map((e) => [e.key, e.data.min_severity, e.data.reason]),
    [
      ['warning_ended', 'minor', 'all_clear'],
      ['warning_ended', 'moderate', 'all_clear'],
    ],
  );
  assert.equal(events[0].data.ended_at, new Date(FIXTURE_NOW).toISOString());
});

test('an all-clear under the same id ends it too', () => {
  const [, second] = run(
    reading([warning({ id: 'a' })]),
    reading([warning({ id: 'a', msgType: 'Cancel' })]),
  );
  assert.deepEqual(summary(second), ['ended:a:all_clear:123']);
});

test('an expired warning ends at once; a withdrawn one after two missing readings', () => {
  const expiring = warning(
    { id: 'e', severity: 'Minor' },
    details({ id: 'e', expires: new Date(FIXTURE_NOW + 4 * MINUTE).toISOString() }),
  );
  const steps = run(
    reading([expiring, warning({ id: 'w', severity: 'Minor' })]),
    reading([], FIXTURE_NOW + 5 * MINUTE),
    reading([], FIXTURE_NOW + 10 * MINUTE),
  );
  assert.deepEqual(summary(steps[1]), ['ended:e:expired:1']);
  assert.deepEqual(summary(steps[2]), ['ended:w:cancelled:1']);
});

test('a warning missing once then back is neither ended nor issued again', () => {
  const steps = run(
    reading([warning({ id: 'a' })]),
    reading([]),
    reading([warning({ id: 'a' })]),
    reading([]),
  );
  assert.deepEqual(steps.map(summary), [[], [], [], []]);
});
