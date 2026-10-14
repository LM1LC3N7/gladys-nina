// -----------------------------------------------------------------------------
// The manifest is the contract with Gladys and the store: these tests tie it
// to the code, so a key renamed on one side only fails here.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACTIONS,
  END_REASONS,
  LANGUAGES,
  POLL,
  SCENE_ACTIONS,
  SCENE_TRIGGERS,
  SEVERITIES,
  SOURCE_KEYS,
  WIDGETS,
} from '../src/constants.js';
import { DEFAULTS } from '../src/config.js';
import { placeReading, warningOf } from '../src/model.js';
import { sceneEvents } from '../src/triggers.js';
import { FIXTURE_NOW, details, item } from './helpers/fakeNina.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('gladys-assistant-integration.json'));
const index = read('index.js');

function* texts(node, path = '') {
  if (Array.isArray(node)) {
    for (const [i, entry] of node.entries()) {
      yield* texts(entry, `${path}[${i}]`);
    }
  } else if (node && typeof node === 'object') {
    if ('en' in node || 'fr' in node) {
      yield [path, node];
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      yield* texts(value, `${path}.${key}`);
    }
  }
}

test('the store basics', () => {
  assert.equal(manifest.manifest_version, 1);
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.location, true, 'the houses are located in their municipality');
  assert.match(manifest.gladys_version, />=5\.1\.0/);
  assert.equal(manifest.docker_image, `ghcr.io/lm1lc3n7/gladys-nina:${manifest.version}`);
  assert.equal(manifest.version, JSON.parse(read('package.json')).version);
  assert.deepEqual(manifest.categories, ['security', 'environment']);
  for (const lang of ['en', 'fr']) {
    const length = manifest.description[lang].length;
    assert.ok(length >= 10 && length <= 100, `description.${lang}: ${length} characters`);
    assert.ok(read(`docs/${lang}.md`).length >= 300, `docs/${lang}.md is too short for the store`);
  }
  assert.match(manifest.description.en, /Unofficial/);
  assert.match(manifest.description.fr, /non officiel/);
  const intro = manifest.config_schema.find((f) => f.key === 'intro').description;
  assert.match(intro.en, /not affiliated with the BBK/);
  assert.match(intro.en, /NOT a safety system/);
  assert.match(intro.fr, /PAS un système de sécurité/);
});

test('every text is bilingual', () => {
  for (const [path, text] of texts(manifest)) {
    assert.ok(text.en?.trim() && text.fr?.trim(), `${path} needs en and fr`);
  }
});

test('the configuration matches the code', () => {
  const fields = Object.fromEntries(manifest.config_schema.map((f) => [f.key, f]));
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (key === 'municipalities') {
      assert.equal(fields[key].default, undefined);
    } else {
      assert.deepEqual(fields[key].default, value, key);
    }
  }
  assert.equal(fields.poll_interval.min, POLL.min);
  assert.equal(fields.poll_interval.max, POLL.max);
  assert.deepEqual(
    fields.language.options.map((o) => o.value),
    LANGUAGES,
  );
  assert.deepEqual(
    fields.sources.options.map((o) => o.value),
    SOURCE_KEYS,
  );
});

test('the keys of the manifest are the keys of the code', () => {
  assert.deepEqual(manifest.actions.map((a) => a.key).sort(), Object.values(ACTIONS).sort());
  assert.deepEqual(
    manifest.scene_actions.map((a) => a.key).sort(),
    Object.values(SCENE_ACTIONS).sort(),
  );
  assert.deepEqual(
    manifest.scene_triggers.map((t) => t.key).sort(),
    Object.values(SCENE_TRIGGERS).sort(),
  );
  assert.deepEqual(manifest.widgets.map((w) => w.key).sort(), Object.values(WIDGETS).sort());
  for (const name of Object.keys(SCENE_ACTIONS)) {
    assert.ok(index.includes(`onSceneAction(SCENE_ACTIONS.${name}`), name);
  }
  for (const name of Object.keys(ACTIONS)) {
    assert.ok(index.includes(`onAction(ACTIONS.${name}`), name);
  }
  assert.equal(manifest.widgets[0].settings[0].key, 'house');
  assert.equal(manifest.scene_actions[0].fields[0].key, 'house');
});

test('the trigger fields and variables are what the events carry', () => {
  const warning = warningOf(item({ id: 'a', severity: 'Severe' }), details({ id: 'a' }));
  const reading = placeReading([warning], FIXTURE_NOW);
  const events = sceneEvents(
    [
      { type: 'issued', warning: reading.active[0], levels: [1] },
      { type: 'ended', warning: reading.active[0], reason: END_REASONS.ALL_CLEAR, levels: [1] },
    ],
    { deviceId: 'd', placeName: 'P', language: 'en', now: FIXTURE_NOW },
  );
  for (const trigger of manifest.scene_triggers) {
    const event = events.find((e) => e.key === trigger.key);
    const sent = Object.keys(event.data);
    for (const declared of [...trigger.fields, ...trigger.variables]) {
      assert.ok(sent.includes(declared.key), `${trigger.key}.${declared.key} is never sent`);
    }
    const option = (key) => trigger.fields.find((f) => f.key === key).options.map((o) => o.value);
    assert.deepEqual(option('min_severity'), SEVERITIES);
    assert.deepEqual(option('source'), SOURCE_KEYS);
    assert.equal(trigger.fields.find((f) => f.key === 'min_severity').required, true);
    assert.equal(trigger.fields.find((f) => f.key === 'source').required, false, 'empty: any');
  }
  const ended = manifest.scene_triggers.find((t) => t.key === SCENE_TRIGGERS.ENDED);
  assert.deepEqual(
    ended.fields.find((f) => f.key === 'reason').options.map((o) => o.value),
    Object.values(END_REASONS),
  );
  assert.deepEqual(
    manifest.scene_actions[0].outputs.map((o) => o.key),
    ['place', 'count', 'highest_severity', 'highest_severity_name', 'titles', 'summary'],
    'the outputs checked against getWarnings in test/app.test.js',
  );
});
