// -----------------------------------------------------------------------------
// A dashboard item and its CAP details -> a plain warning, and the warnings of
// a place -> a reading. Pure: `now` is a parameter (milliseconds).
//
// What NINA sends (recorded on 2026-10-14):
//   - the dashboard item: id, sent, i18nTitle (de, and for MoWaS en, fr, ar,
//     es, pl, ru, tr: the generic event name), payload { version, hash, data:
//     { headline, provider, severity, msgType, area: { type, data }, valid } };
//   - the details (/warnings/<id>.json): sender, sent, status, msgType,
//     references ("sender,identifier,sent" triples separated by spaces) and one
//     `info` block per language (de, de-LS, en, fr...): headline, description,
//     instruction (HTML), expires, senderName, area[].areaDesc, web. Only the
//     headline is translated: the description stays German in every block.
// The MoWaS terms: "may only be used unchanged in content and not for
// commercial purposes". Texts are passed as given: HTML turned into plain
// text, cut to Gladys' limits with "…", with the link to the full message.
// -----------------------------------------------------------------------------

import { LIMITS, SEVERITIES, SOURCES, WARNING_PAGE } from './constants.js';

/** CAP severity -> level 1 to 4. "Unknown" counts as minor: a warning is never 0. */
export function severityLevel(severity) {
  const index = SEVERITIES.indexOf(String(severity ?? '').toLowerCase());
  return index >= 0 ? index + 1 : 1;
}

const PROVIDER_PREFIXES = {
  mow: 'MOWAS',
  kat: 'KATWARN',
  biw: 'BIWAPP',
  dwd: 'DWD',
  lhp: 'LHP',
  pol: 'POLICE',
};

/** MOWAS, KATWARN, BIWAPP, DWD, LHP or POLICE (from the payload, else the id prefix). */
export function providerOf(item) {
  const provider = String(item?.payload?.data?.provider ?? '').toUpperCase();
  if (provider) {
    return provider;
  }
  return PROVIDER_PREFIXES[String(item?.id ?? '').slice(0, 3)] ?? 'MOWAS';
}

/** The source group of a provider (civil_protection, weather, flood, police). */
export function sourceOf(provider) {
  const upper = String(provider ?? '').toUpperCase();
  return (
    Object.keys(SOURCES).find((key) => SOURCES[key].includes(upper)) ??
    (upper.startsWith('DWD') ? 'weather' : 'civil_protection')
  );
}

/** How the official app writes the providers. */
export const PROVIDER_NAMES = {
  MOWAS: 'MoWaS',
  KATWARN: 'KATWARN',
  BIWAPP: 'BIWAPP',
  DWD: 'DWD',
  LHP: 'LHP',
  POLICE: 'Polizei',
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** CAP HTML ("<br/>", "&quot;") -> plain text with line breaks. */
export function htmlToText(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, code) => {
      if (code[0] === '#') {
        const n =
          code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : all;
      }
      return ENTITIES[code.toLowerCase()] ?? all;
    })
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Cut a text to `max` characters, "…" included. */
export function cut(text, max) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/** The info block of a language: exact, then the language family, then German. */
function infoOf(details, language) {
  const infos = Array.isArray(details?.info) ? details.info : [];
  return (
    infos.find((i) => i?.language === language) ??
    infos.find((i) => String(i?.language ?? '').startsWith(`${language}-`)) ??
    infos.find((i) => i?.language === 'de') ??
    infos[0]
  );
}

const parameter = (info, name) =>
  (Array.isArray(info?.parameter) ? info.parameter : []).find((p) => p?.valueName === name)?.value;

/** "DE-NI,mow.A-000,2026-10-14T07:19:51-00:00 DE-NI,mow.B-001,..." -> ["mow.A-000", "mow.B-001"]. */
export function referencesOf(details) {
  return String(details?.references ?? '')
    .split(/\s+/)
    .map((triple) => triple.split(',')[1])
    .filter(Boolean);
}

const time = (value) => {
  const ms = Date.parse(value ?? '');
  return Number.isFinite(ms) ? ms : null;
};

const https = (url) => (/^https:\/\/[^\s]+$/.test(String(url ?? '')) ? String(url) : null);

/** The official page of a warning, as the NINA RSS feeds link it. */
export function warningLink(id, headline) {
  const slug = String(headline ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 120);
  return `${WARNING_PAGE}/${encodeURIComponent(id)}${slug ? `/${encodeURIComponent(slug)}` : ''}`;
}

/** The revision of a dashboard item: a new one is a new version of the warning. */
export const revisionOf = (item) =>
  `${item?.payload?.version ?? ''}:${item?.payload?.hash ?? item?.sent ?? ''}`;

/**
 * One warning from a dashboard item and its details (when they could be read).
 * Language-free: the titles of every language are kept, `titleOf` picks.
 */
export function warningOf(item, details) {
  const data = item?.payload?.data ?? {};
  const de = infoOf(details, 'de');
  const provider = providerOf(item);
  const i18n = item?.i18nTitle ?? {};
  const headline = htmlToText(de?.headline ?? data.headline ?? i18n.de ?? '');
  const titles = {};
  for (const lang of ['de', 'en', 'fr']) {
    const title = i18n[lang] ?? (lang === 'de' ? headline : undefined);
    if (title) {
      titles[lang] = htmlToText(title);
    }
  }
  const msgType = String(data.msgType ?? details?.msgType ?? 'Alert').toLowerCase();
  const id = String(item?.id ?? data.id ?? details?.identifier ?? '');
  return {
    id,
    revision: revisionOf(item),
    provider,
    providerName: PROVIDER_NAMES[provider] ?? provider,
    source: sourceOf(provider),
    msgType,
    status: String(details?.status ?? 'Actual'),
    valid: data.valid !== false,
    severity: severityLevel(data.severity ?? de?.severity),
    urgency: de?.urgency ?? data.urgency ?? null,
    titles,
    headline,
    description: htmlToText(de?.description),
    instruction: htmlToText(de?.instruction),
    area: (Array.isArray(de?.area) ? de.area : [])
      .map((a) => htmlToText(a?.areaDesc))
      .filter(Boolean)
      .join(', '),
    sender: htmlToText(de?.senderName ?? parameter(de, 'sender_langname') ?? ''),
    sent: item?.sent ?? details?.sent ?? null,
    expires: de?.expires ?? null,
    references: referencesOf(details),
    web: https(de?.web),
    link: warningLink(id, headline),
    detailed: Boolean(details),
  };
}

/**
 * The title of a warning in a language: its own translation, else German
 * (NINA translates the MoWaS event names; the DWD, LHP and police texts are
 * German, sometimes English).
 */
export function titleOf(warning, language = 'en') {
  return warning.titles[language] ?? warning.titles.de ?? warning.headline;
}

/** Is a warning in force at `now`? An all-clear, a test or an expired one is not. */
export function isActive(warning, now) {
  if (warning.msgType === 'cancel' || warning.status !== 'Actual' || !warning.valid) {
    return false;
  }
  const expires = time(warning.expires);
  return expires === null || expires > now;
}

const bySeverityThenTime = (a, b) =>
  b.severity - a.severity || (time(b.sent) ?? 0) - (time(a.sent) ?? 0);

/**
 * The reading of a place: the warnings in force (most severe first), the
 * all-clear messages still listed, the count and the highest level.
 */
export function placeReading(warnings, now) {
  const active = warnings.filter((w) => isActive(w, now)).sort(bySeverityThenTime);
  const allClear = warnings.filter(
    (w) =>
      w.msgType === 'cancel' &&
      w.status === 'Actual' &&
      !(time(w.expires) !== null && time(w.expires) <= now),
  );
  return {
    readAt: new Date(now).toISOString(),
    active,
    allClear,
    count: active.length,
    highest: active.reduce((max, w) => Math.max(max, w.severity), 0),
  };
}

/** Bounded texts of a warning, for a state or a scene event. */
export function texts(warning, language) {
  return {
    title: cut(titleOf(warning, language), LIMITS.title),
    headline: cut(warning.headline, LIMITS.headline),
    description: cut(warning.description, LIMITS.text),
    instruction: cut(warning.instruction, LIMITS.text),
    area: cut(warning.area, LIMITS.headline),
  };
}
