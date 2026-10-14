// -----------------------------------------------------------------------------
// Every runtime text exists in English, French and German, within the limits
// the core applies (badges 16 characters, tile labels 24).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE_NAMES, SEVERITY_NAMES, SOURCE_NAMES, T } from '../src/i18n.js';

const LANGS = ['en', 'fr', 'de'];

/** A text function with sample arguments: (name, count, count), or (name, list). */
const call = (fn) => {
  try {
    return fn('X', 2, 3);
  } catch {
    return fn('X', ['a', 'b']);
  }
};

/** Every text object of a table, the functions called with sample arguments. */
function* texts(node, path = 'T') {
  if (typeof node === 'function') {
    yield* texts(call(node), `${path}()`);
  } else if (node && typeof node === 'object' && !Array.isArray(node)) {
    if (LANGS.some((l) => l in node)) {
      yield [path, node];
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      yield* texts(value, `${path}.${key}`);
    }
  }
}

test('every runtime text is in English, French and German', () => {
  const all = [
    ...texts(T),
    ...texts(FEATURE_NAMES, 'FEATURE_NAMES'),
    ...texts(SOURCE_NAMES, 'SOURCE_NAMES'),
  ];
  assert.ok(all.length > 30);
  for (const [path, text] of all) {
    for (const lang of LANGS) {
      assert.equal(typeof text[lang], 'string', `${path} needs ${lang}`);
      assert.ok(text[lang].trim(), `${path}.${lang} is empty`);
    }
  }
  for (const lang of LANGS) {
    assert.equal(SEVERITY_NAMES[lang].length, 5, `SEVERITY_NAMES.${lang}`);
  }
});

test('the short texts fit the widget', () => {
  for (const lang of LANGS) {
    assert.ok(T.widget.allClear[lang].length <= 16, `allClear.${lang}`);
    assert.ok(T.widget.tileNone[lang].length <= 24, `tileNone.${lang}`);
    for (const count of [1, 2]) {
      assert.ok(T.widget.tileActive(count)[lang].length <= 24, `tileActive.${lang}`);
    }
    for (const name of SEVERITY_NAMES[lang]) {
      assert.ok(name.length <= 16, `severity ${name}`);
    }
  }
});
