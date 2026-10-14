// -----------------------------------------------------------------------------
// The Gladys devices and their states. Pure.
//
// External ids (forever):
//   house:<houseSelector>   the municipality of a located house of Gladys
//   place:<ARS>             a municipality (or district) typed in the configuration
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
} from '@gladysassistant/integration-sdk';
import { LIMITS } from './constants.js';
import { cut, titleOf } from './model.js';

export const DEVICE_KINDS = { HOUSE: 'house', PLACE: 'place' };

export const FEATURE = {
  COUNT: 'count',
  SEVERITY: 'severity',
  HEADLINE: 'headline',
};

export const ids = {
  house: (gladys, selector) => gladys.externalId(`house:${selector}`),
  place: (gladys, ars) => gladys.externalId(`place:${ars}`),
  feature: (deviceId, key) => `${deviceId}:${key}`,
};

/** { kind: 'house', selector } | { kind: 'place', ars } | undefined. */
export function parseExternalId(externalId) {
  const text = String(externalId ?? '');
  const house = /:house:([^:]+)$/.exec(text);
  if (house) {
    return { kind: DEVICE_KINDS.HOUSE, selector: house[1] };
  }
  const place = /:place:(\d{12})$/.exec(text);
  return place ? { kind: DEVICE_KINDS.PLACE, ars: place[1] } : undefined;
}

const feature = (deviceId, key, name, category, type, extra = {}) => ({
  name,
  external_id: ids.feature(deviceId, key),
  category,
  type,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  ...extra,
});

/**
 * The device of a watched place. `watch` is { kind, selector?, houseName?,
 * place }: the municipality found is stored as params (shown in Gladys, and
 * the fallback of the poll path when the house cannot be located again).
 */
export function buildPlaceDevice(gladys, { kind, selector, houseName, place }) {
  const id =
    kind === DEVICE_KINDS.HOUSE ? ids.house(gladys, selector) : ids.place(gladys, place.ars);
  return {
    name: `NINA ${houseName ?? place.name}`,
    external_id: id,
    features: [
      feature(id, FEATURE.COUNT, 'Warnings in force', C.COUNTER_SENSOR, T.SENSOR.INTEGER, {
        min: 0,
        max: 100,
      }),
      feature(id, FEATURE.SEVERITY, 'Highest severity (0-4)', C.RISK, T.RISK.INTEGER, {
        min: 0,
        max: 4,
      }),
      feature(id, FEATURE.HEADLINE, 'Most severe warning', C.TEXT, T.TEXT.TEXT, {
        min: 0,
        max: 0,
        keep_history: false,
      }),
    ],
    params: [
      { name: 'ars', value: place.ars },
      { name: 'municipality', value: place.name },
      { name: 'district', value: place.districtName },
      ...(selector ? [{ name: 'house', value: selector }] : []),
    ],
  };
}

const params = (device) => Object.fromEntries((device?.params ?? []).map((p) => [p.name, p.value]));

/** The ARS stored on a device (the poll path's fallback). */
export const arsOfDevice = (device) => {
  const value = String(params(device).ars ?? parseExternalId(device?.external_id)?.ars ?? '');
  return /^\d{12}$/.test(value) ? value : undefined;
};

const state = (deviceId, key, value) =>
  typeof value === 'string'
    ? { device_feature_external_id: ids.feature(deviceId, key), text: value }
    : { device_feature_external_id: ids.feature(deviceId, key), state: value };

/** The states of a place: count, highest level, title of the most severe warning. */
export function placeStates(deviceId, reading, language) {
  const top = reading.active[0];
  return [
    state(deviceId, FEATURE.COUNT, reading.count),
    state(deviceId, FEATURE.SEVERITY, reading.highest),
    state(deviceId, FEATURE.HEADLINE, top ? cut(titleOf(top, language), LIMITS.state) : '—'),
  ];
}
