// -----------------------------------------------------------------------------
// The dashboard widget "warnings": a status tile (a check, or the count in
// the colour of the most severe warning), the warnings in force for a place,
// most severe first (severity badge, source, time, the official text on tap),
// the all-clear messages still listed, and the reminder that this is not a
// safety system. Pure.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { T, severityName, word, SOURCE_NAMES } from './i18n.js';
import { cut, titleOf } from './model.js';

const pick = (text, language) => (typeof text === 'string' ? text : (text[language] ?? text.en));

const SEVERITY_COLORS = [
  WIDGET_COLORS.NEUTRAL,
  WIDGET_COLORS.INFO,
  WIDGET_COLORS.WARNING,
  WIDGET_COLORS.DANGER,
  WIDGET_COLORS.DANGER,
];

const capitalized = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** The text of the detail panel: the official message, unchanged, then where it comes from. */
function detail(warning, language) {
  const lines = [warning.headline];
  if (warning.description) {
    lines.push('', warning.description);
  }
  if (warning.instruction) {
    lines.push('', warning.instruction);
  }
  const meta = [];
  if (warning.area) {
    meta.push(warning.area);
  }
  if (warning.sender) {
    meta.push(`${pick(T.widget.sentBy, language)}: ${warning.sender}`);
  }
  if (meta.length > 0) {
    lines.push('', meta.join(' · '));
  }
  const note = pick(T.widget.detailNote, language);
  const text = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  return `${cut(text, 2000 - note.length - 2)}\n\n${note}`;
}

function links(warning, language) {
  const list = [{ url: warning.link, label: pick(T.widget.official, language) }];
  if (warning.web) {
    list.push({ url: warning.web, label: pick(T.widget.moreInfo, language) });
  }
  return list;
}

function card(warning, language, allClear = false) {
  const source = word(SOURCE_NAMES[warning.source], language);
  return {
    title: cut(titleOf(warning, language), 60),
    subtitle: cut(
      `${source} · ${warning.providerName}${warning.area ? ` · ${warning.area}` : ''}`,
      60,
    ),
    ...(warning.sent ? { date: warning.sent } : {}),
    badge: allClear
      ? { text: pick(T.widget.allClear, language), color: WIDGET_COLORS.SUCCESS }
      : {
          text: cut(capitalized(severityName(warning.severity, language)), 16),
          color: SEVERITY_COLORS[warning.severity],
        },
    description: detail(warning, language),
    links: links(warning, language),
  };
}

/**
 * The status at a glance (asked on the forum): a green check when nothing is
 * in force, else an exclamation mark and the count, in the colour of the most
 * severe warning (the colours of the badges below).
 */
function statusTile(reading, language) {
  const calm = reading.count === 0;
  return {
    type: 'value',
    value: reading.count,
    label: pick(calm ? T.widget.tileNone : T.widget.tileActive(reading.count), language),
    icon: calm ? 'check-circle' : 'alert-circle',
    color: calm ? WIDGET_COLORS.SUCCESS : SEVERITY_COLORS[reading.highest],
  };
}

export function warningsWidget({ name, placeName, reading, language = 'fr' }) {
  const components = [{ type: 'text', text: cut(name ?? 'NINA', 40), variant: 'heading' }];
  if (!reading) {
    components.push({ type: 'text', text: T.widget.notLoaded, variant: 'body' });
    return { ttl_seconds: 30, components };
  }
  components.push(statusTile(reading, language));
  const items = [
    ...reading.active.map((w) => card(w, language)),
    ...reading.allClear.map((w) => card(w, language, true)),
  ].slice(0, 8);
  if (items.length > 0) {
    components.push({ type: 'card-list', display: 'list', items });
  }
  const none =
    reading.count === 0 ? `${pick(T.widget.none(placeName ?? name ?? 'NINA'), language)}\n` : '';
  components.push({
    type: 'text',
    text: cut(`${none}${pick(T.widget.footer, language)}`, 300),
    variant: 'body',
  });
  return { ttl_seconds: reading.count > 0 ? 60 : 300, components };
}
