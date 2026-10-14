import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildDirectory,
  concernsPlace,
  containsPoint,
  distanceToOutlineKm,
  fold,
  gridCell,
  parseRanges,
  placeLine,
  resolvePlace,
  scanGrid,
  searchPlaces,
} from '../src/places.js';
import { HOME, fixture } from './helpers/fakeNina.js';

const directory = () => buildDirectory(fixture('municipalities.json'), fixture('districts.json'));
const gridText = () => readFileSync(new URL('./fixtures/grid.json', import.meta.url), 'utf8');

test('the directory of the official app', () => {
  const d = directory();
  const alsdorf = d.byArs.get('053340004004');
  assert.equal(alsdorf.zid, 3251);
  assert.equal(alsdorf.name, 'Alsdorf');
  assert.equal(alsdorf.districtName, 'Städteregion Aachen', '"Landkreis " dropped');
  assert.equal(
    d.byArs.get('110000000000').name,
    'Berlin',
    'a district-free city is named by its district',
  );
  assert.equal(placeLine(alsdorf), 'Alsdorf (Städteregion Aachen) – 053340004004');
  assert.equal(placeLine(d.byArs.get('020000000000')), 'Hamburg – 020000000000');
  assert.equal(fold('Würselen  (Rhld.)'), 'wurselen rhld');
});

test('a typed name or ARS becomes a place', () => {
  const d = directory();
  const alsdorf = resolvePlace(d, 'alsdorf').place;
  assert.equal(alsdorf.ars, '053340004004');
  assert.equal(alsdorf.districtArs, '053340000000', 'NINA serves districts');
  assert.equal(resolvePlace(d, '053340004004').place.name, 'Alsdorf');
  assert.equal(resolvePlace(d, 'Berlin').place.zid, 2825);
  assert.equal(resolvePlace(d, 'Cappeln (Oldenburg)').place.ars, '034530003003');
  const ambiguous = resolvePlace(d, 'Neuenkirchen');
  assert.equal(ambiguous.error, 'ambiguous');
  assert.equal(ambiguous.matches.length, 2);
  assert.equal(resolvePlace(d, 'Neuenkirchen (Diepholz)').place.ars, '032515406028');
  const district = resolvePlace(d, 'Landkreis Cloppenburg').place;
  assert.equal(district.level, 'district');
  assert.equal(district.ars, '034530000000');
  assert.equal(resolvePlace(d, '05334').place.level, 'district');
  assert.equal(resolvePlace(d, 'Atlantis').error, 'unknown');
  assert.equal(resolvePlace(d, '999990000000').error, 'unknown');
});

test('a line of the search results, pasted whole, is understood (forum report)', () => {
  const d = directory();
  const line = placeLine(resolvePlace(d, 'Neuenkirchen (Diepholz)').place);
  assert.equal(line, 'Neuenkirchen (Diepholz) – 032515406028');
  assert.equal(resolvePlace(d, line).place.ars, '032515406028');
  // The dash may come back as a hyphen or an em dash once copied.
  assert.equal(
    resolvePlace(d, 'Alsdorf (Städteregion Aachen) - 053340004004').place.name,
    'Alsdorf',
  );
  assert.equal(
    resolvePlace(d, 'Alsdorf (Städteregion Aachen) — 053340004004').place.name,
    'Alsdorf',
  );
  // The line of the Test button too ("ARS → Name (District) – ARS").
  assert.equal(
    resolvePlace(d, '053340004004 → Alsdorf (Städteregion Aachen) – 053340004004').place.name,
    'Alsdorf',
  );
  assert.equal(resolvePlace(d, 'Landkreis Cloppenburg – 034530000000').place.level, 'district');
  assert.equal(resolvePlace(d, 'Atlantis – 999990000000').error, 'unknown');
});

test('the search ranks exact names first, then the populous ones', () => {
  const d = directory();
  assert.deepEqual(
    searchPlaces(d, 'aachen').map((m) => m.name),
    ['Aachen'],
  );
  const results = searchPlaces(d, 'al');
  assert.equal(results[0].name, 'Alsdorf', 'starts with "al", the biggest');
  assert.ok(results.some((m) => m.name === 'Aldenhoven'));
  assert.deepEqual(searchPlaces(d, ''), []);
});

test('the grid cell of a point is the one of the official mapping', () => {
  assert.equal(gridCell(HOME.latitude, HOME.longitude), 255642);
  assert.equal(gridCell(48.8566, 2.3522), null, 'Paris is outside the grid');
  const text = gridText();
  // Every recorded municipality point falls in a cell that lists it.
  const { candidates } = scanGrid(text, {
    cells: [...directory().municipalities.values()].map((m) => gridCell(m.lat, m.lng)),
  });
  for (const m of directory().municipalities.values()) {
    const cell = gridCell(m.lat, m.lng);
    if (candidates.has(cell)) {
      assert.ok(candidates.get(cell).includes(m.zid), m.name);
    }
  }
});

test('the grid file is scanned for the cells and municipalities needed only', () => {
  const { candidates, cellsOf } = scanGrid(gridText(), { cells: [255642], zids: [2825] });
  assert.deepEqual(candidates.get(255642), [3251, 3252]);
  assert.equal(cellsOf.get(3251).size, 40, 'the cells of the candidates are collected too');
  assert.ok(cellsOf.get(3251).has(255642));
  assert.deepEqual([...cellsOf.get(2825)], [155592]);
  const spaced = scanGrid('{"1": [7, 8], "2": []}', { cells: [1, 2] });
  assert.deepEqual(spaced.candidates.get(1), [7, 8]);
  assert.deepEqual(spaced.candidates.get(2), []);
});

test('points and outlines', () => {
  const alsdorf = fixture('polygons/3251.geojson').geometry;
  const baesweiler = fixture('polygons/3252.geojson').geometry;
  const home = [HOME.longitude, HOME.latitude];
  assert.equal(containsPoint(alsdorf, home), true);
  assert.equal(containsPoint(baesweiler, home), false);
  assert.equal(containsPoint(baesweiler, [6.1645, 50.889]), true);
  assert.ok(distanceToOutlineKm(alsdorf, [6.1645, 50.889]) < 0.1);
  assert.ok(distanceToOutlineKm(alsdorf, [6.5, 50.885]) > 15);
  const holed = {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
        [
          [1, 1],
          [2, 1],
          [2, 2],
          [1, 2],
          [1, 1],
        ],
      ],
    ],
  };
  assert.equal(containsPoint(holed, [3, 3]), true);
  assert.equal(containsPoint(holed, [1.5, 1.5]), false, 'in the hole');
});

test('does a warning concern the place? ZGEM, GRID, district', () => {
  const alsdorf = resolvePlace(directory(), 'Alsdorf').place;
  assert.deepEqual(parseRanges('3251,136849+2,100001'), [
    [3251, 3251],
    [136849, 136851],
    [100001, 100001],
  ]);
  assert.equal(concernsPlace({ type: 'ZGEM', data: '3251,100001' }, alsdorf), true);
  assert.equal(concernsPlace({ type: 'ZGEM', data: '3249+5,100001' }, alsdorf), true, 'a range');
  assert.equal(concernsPlace({ type: 'ZGEM', data: '3252,100001' }, alsdorf), false);
  const grid = { type: 'GRID', data: '255640+2,500001' };
  assert.equal(concernsPlace(grid, alsdorf, new Map()), null, 'cells unknown yet');
  const { cellsOf } = scanGrid(gridText(), { zids: [3251] });
  assert.equal(concernsPlace(grid, alsdorf, cellsOf), true);
  assert.equal(concernsPlace({ type: 'GRID', data: '1+5,500001' }, alsdorf, cellsOf), false);
  const district = resolvePlace(directory(), '05334').place;
  assert.equal(concernsPlace({ type: 'ZGEM', data: '3252' }, district), true);
  assert.equal(concernsPlace(undefined, alsdorf), true, 'no area: district-wide');
});
