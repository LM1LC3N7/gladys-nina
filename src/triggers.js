// -----------------------------------------------------------------------------
// Two readings of a place -> scene events. Pure. Nothing fires on the first
// reading (no transition without a previous value), and each event is one
// transition of one warning:
//   warning_issued  a new warning, or a new version whose severity rose: one
//                   event per minimum severity newly reached (the trigger
//                   field is matched by equality, so "at least severe" is the
//                   event of the "severe" mark, sent once per warning);
//   warning_ended   all clear, expired or withdrawn: one event per minimum
//                   severity the warning had reached.
// A new version of a warning keeps its identity: same id, or a new id whose
// CAP `references` name the previous one (MoWaS updates, DWD warnings).
// -----------------------------------------------------------------------------

import { END_REASONS, MISSING_READINGS, SCENE_TRIGGERS, SEVERITIES } from './constants.js';
import { severityName } from './i18n.js';
import { texts } from './model.js';

const time = (value) => {
  const ms = Date.parse(value ?? '');
  return Number.isFinite(ms) ? ms : null;
};

const entryOf = (warning, previous) => ({
  warning,
  ids: new Set([...(previous?.ids ?? []), warning.id]),
  maxLevel: Math.max(previous?.maxLevel ?? 0, warning.severity),
  missing: 0,
});

const levels = (from, to) => {
  const list = [];
  for (let level = from + 1; level <= to; level += 1) {
    list.push(level);
  }
  return list;
};

/**
 * The tracked warnings of a place after a reading, and the transitions.
 *   previous / tracked: Map(key -> { warning, ids, maxLevel, missing })
 *   transitions: [{ type: 'issued', warning, levels }
 *                 | { type: 'ended', warning, reason, levels }]
 */
export function trackWarnings(previous, reading, now) {
  const tracked = new Map();
  const transitions = [];
  if (!previous) {
    for (const warning of reading.active) {
      tracked.set(warning.id, entryOf(warning));
    }
    return { tracked, transitions };
  }
  const keyOfId = new Map();
  for (const [key, entry] of previous) {
    for (const id of entry.ids) {
      keyOfId.set(id, key);
    }
  }
  const free = (key) => key !== undefined && !tracked.has(key);
  for (const warning of reading.active) {
    let key = keyOfId.get(warning.id);
    if (!free(key)) {
      key = warning.references.map((id) => keyOfId.get(id)).find(free);
    }
    if (free(key)) {
      const before = previous.get(key);
      tracked.set(key, entryOf(warning, before));
      if (warning.severity > before.maxLevel) {
        transitions.push({
          type: 'issued',
          warning,
          levels: levels(before.maxLevel, warning.severity),
        });
      }
    } else if (!tracked.has(warning.id)) {
      tracked.set(warning.id, entryOf(warning));
      transitions.push({ type: 'issued', warning, levels: levels(0, warning.severity) });
    }
  }
  for (const [key, entry] of previous) {
    if (tracked.has(key)) {
      continue;
    }
    const cleared = reading.allClear.some(
      (c) => entry.ids.has(c.id) || c.references.some((id) => entry.ids.has(id)),
    );
    const expires = time(entry.warning.expires);
    let reason;
    if (cleared) {
      reason = END_REASONS.ALL_CLEAR;
    } else if (expires !== null && expires <= now) {
      reason = END_REASONS.EXPIRED;
    } else if (entry.missing + 1 >= MISSING_READINGS) {
      reason = END_REASONS.CANCELLED;
    } else {
      // Missing once: kept (not counted), ended only if still missing next time.
      tracked.set(key, { ...entry, missing: entry.missing + 1 });
      continue;
    }
    transitions.push({
      type: 'ended',
      warning: entry.warning,
      reason,
      levels: levels(0, entry.maxLevel),
    });
  }
  return { tracked, transitions };
}

/** The scene events of the transitions of one place. */
export function sceneEvents(transitions, { deviceId, placeName, language = 'en', now }) {
  const events = [];
  for (const transition of transitions) {
    const { warning } = transition;
    const text = texts(warning, language);
    const common = {
      house: deviceId,
      source: warning.source,
      id: warning.id,
      title: text.title,
      headline: text.headline,
      description: text.description || null,
      instruction: text.instruction || null,
      severity: warning.severity,
      severity_name: severityName(warning.severity, language),
      provider: warning.providerName,
      area: text.area || null,
      sent: warning.sent ?? null,
      expires: warning.expires ?? null,
      link: warning.link,
      place: placeName,
    };
    for (const level of transition.levels) {
      const minSeverity = SEVERITIES[level - 1];
      events.push(
        transition.type === 'issued'
          ? { key: SCENE_TRIGGERS.ISSUED, data: { ...common, min_severity: minSeverity } }
          : {
              key: SCENE_TRIGGERS.ENDED,
              data: {
                ...common,
                min_severity: minSeverity,
                reason: transition.reason,
                ended_at: new Date(now).toISOString(),
              },
            },
      );
    }
  }
  return events;
}
