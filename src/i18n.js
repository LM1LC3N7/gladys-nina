// -----------------------------------------------------------------------------
// Runtime texts shown in Gladys (connection status, buttons, widget) and the
// words of the warnings (severities, sources, summaries, feature names) in
// en/fr/de. The German texts say "du", like the German Gladys interface. The
// words of the warnings follow the `language` of the configuration (devices,
// scene variables); the widget follows the language of the user.
// -----------------------------------------------------------------------------

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Severity names by level (1 to 4); 0 is "none". */
export const SEVERITY_NAMES = {
  en: ['none', 'minor', 'moderate', 'severe', 'extreme'],
  fr: ['aucun', 'mineur', 'modéré', 'sévère', 'extrême'],
  de: ['keine', 'gering', 'mäßig', 'schwer', 'extrem'],
};

export const SOURCE_NAMES = {
  civil_protection: { en: 'Civil protection', fr: 'Protection civile', de: 'Bevölkerungsschutz' },
  weather: { en: 'Weather (DWD)', fr: 'Météo (DWD)', de: 'Unwetter (DWD)' },
  flood: { en: 'Flood', fr: 'Crue', de: 'Hochwasser' },
  police: { en: 'Police', fr: 'Police', de: 'Polizei' },
};

/** A word of the warnings in a language (en when the language is unknown). */
export const word = (table, language) => table[language] ?? table.en;
export const severityName = (level, language) =>
  word(SEVERITY_NAMES, language)[Math.max(0, Math.min(4, level))];

/** The names of the device features, in the configured language. */
export const FEATURE_NAMES = {
  count: { en: 'Warnings in force', fr: 'Avertissements en cours', de: 'Aktive Warnungen' },
  severity: { en: 'Highest severity', fr: 'Gravité la plus haute', de: 'Höchste Warnstufe' },
  headline: {
    en: 'Most severe warning',
    fr: 'Avertissement le plus grave',
    de: 'Schwerste Warnung',
  },
};

export const T = {
  ok: (places, warnings) => ({
    en: `Watching ${plural(places, 'place', 'places')} through NINA: ${plural(warnings, 'warning', 'warnings')} in force.`,
    fr: `${plural(places, 'lieu suivi', 'lieux suivis')} via NINA : ${plural(warnings, 'avertissement', 'avertissements')} en cours.`,
    de: `NINA überwacht ${plural(places, 'Ort', 'Orte')}: ${plural(warnings, 'aktive Warnung', 'aktive Warnungen')}.`,
  }),
  noDevice: {
    en: 'Open Discovery and add the NINA device of your house (or of a municipality typed in the configuration).',
    fr: "Ouvrez Découverte et ajoutez l'appareil NINA de votre maison (ou d'une commune saisie dans la configuration).",
    de: 'Öffne „Entdecken“ und füge das NINA-Gerät deines Hauses hinzu (oder das einer in der Konfiguration eingetragenen Gemeinde).',
  },
  noPlace: {
    en: 'Nothing to watch: set the location of your house in Gladys (Germany only), or type a municipality in the configuration, then open Discovery.',
    fr: "Rien à surveiller : renseignez l'emplacement de votre maison dans Gladys (Allemagne seulement), ou saisissez une commune dans la configuration, puis ouvrez Découverte.",
    de: 'Nichts zu überwachen: Lege den Standort deines Hauses in Gladys fest (nur Deutschland) oder trage eine Gemeinde in der Konfiguration ein, und öffne dann „Entdecken“.',
  },
  unreachable: (message) => ({
    en: `NINA (warnung.bund.de) is unreachable: ${message}. Retrying at the next refresh.`,
    fr: `NINA (warnung.bund.de) est injoignable : ${message}. Nouvel essai au prochain rafraîchissement.`,
    de: `NINA (warnung.bund.de) ist nicht erreichbar: ${message}. Neuer Versuch bei der nächsten Aktualisierung.`,
  }),
  housesUnavailable: (message) => ({
    en: `The location of the houses is not available (${message}): reinstall the integration and accept the location access, or type a municipality.`,
    fr: `L'emplacement des maisons n'est pas disponible (${message}) : réinstallez l'intégration et acceptez l'accès à la localisation, ou saisissez une commune.`,
    de: `Der Standort der Häuser ist nicht verfügbar (${message}): Installiere die Integration neu und erlaube den Zugriff auf den Standort, oder trage eine Gemeinde ein.`,
  }),
  outside: (house) => ({
    en: `House "${house}" is not in a German municipality: type its municipality in the configuration.`,
    fr: `La maison « ${house} » n'est pas dans une commune allemande : saisissez sa commune dans la configuration.`,
    de: `Das Haus „${house}“ liegt in keiner deutschen Gemeinde: Trage seine Gemeinde in der Konfiguration ein.`,
  }),
  unknownPlace: (query) => ({
    en: `Unknown municipality "${query}": the "Search a municipality" button gives the exact names and ARS.`,
    fr: `Commune inconnue « ${query} » : le bouton « Chercher une commune » donne les noms exacts et les ARS.`,
    de: `Unbekannte Gemeinde „${query}“: Die Schaltfläche „Gemeinde suchen“ liefert die genauen Namen und ARS.`,
  }),
  ambiguousPlace: (query, matches) => ({
    en: `Several municipalities are named "${query}": type the ARS of yours, or "Name (District)". ${matches.join('; ')}`,
    fr: `Plusieurs communes s'appellent « ${query} » : saisissez l'ARS de la vôtre, ou « Nom (District) ». ${matches.join(' ; ')}`,
    de: `Mehrere Gemeinden heißen „${query}“: Trage den ARS deiner Gemeinde ein oder „Name (Kreis)“. ${matches.join('; ')}`,
  }),
  tooManyPlaces: (max) => ({
    en: `At most ${max} municipalities: the others are ignored.`,
    fr: `Au plus ${max} communes : les autres sont ignorées.`,
    de: `Höchstens ${max} Gemeinden: Die übrigen werden ignoriert.`,
  }),
  noMatch: (query) => ({
    en: `No municipality contains "${query}".`,
    fr: `Aucune commune ne contient « ${query} ».`,
    de: `Keine Gemeinde enthält „${query}“.`,
  }),
  test: {
    directory: (count) => ({
      en: `NINA answers: ${count} municipalities known.`,
      fr: `NINA répond : ${count} communes connues.`,
      de: `NINA antwortet: ${count} Gemeinden bekannt.`,
    }),
    place: (name, municipality, count) => ({
      en: `${name} → ${municipality}: ${plural(count, 'warning', 'warnings')} in force.`,
      fr: `${name} → ${municipality} : ${plural(count, 'avertissement', 'avertissements')} en cours.`,
      de: `${name} → ${municipality}: ${plural(count, 'aktive Warnung', 'aktive Warnungen')}.`,
    }),
    failed: (name, message) => ({
      en: `${name}: ${message}`,
      fr: `${name} : ${message}`,
      de: `${name}: ${message}`,
    }),
    none: {
      en: 'No house located in Germany and no municipality typed yet.',
      fr: 'Aucune maison localisée en Allemagne et aucune commune saisie pour le moment.',
      de: 'Noch kein Haus in Deutschland verortet und keine Gemeinde eingetragen.',
    },
  },
  /** The `summary` output of the scene action, in the configured language. */
  summary: {
    none: (place) => ({
      en: `No warning in force for ${place}.`,
      fr: `Aucun avertissement en cours pour ${place}.`,
      de: `Keine Warnung für ${place}.`,
    }),
    some: (place, count) => ({
      en: `${plural(count, 'warning', 'warnings')} in force for ${place}:`,
      fr: `${plural(count, 'avertissement', 'avertissements')} en cours pour ${place} :`,
      de: `${count} ${count === 1 ? 'Warnung' : 'Warnungen'} für ${place}:`,
    }),
  },
  widget: {
    pickHouse: {
      en: 'Pick the NINA device of a house in the widget settings',
      fr: "Choisissez l'appareil NINA d'une maison dans les réglages du widget",
      de: 'Wähle in den Widget-Einstellungen das NINA-Gerät eines Hauses',
    },
    notLoaded: {
      en: 'Waiting for the first reading…',
      fr: 'En attente de la première lecture…',
      de: 'Warte auf die erste Abfrage…',
    },
    none: (place) => ({
      en: `No warning in force for ${place}.`,
      fr: `Aucun avertissement en cours pour ${place}.`,
      de: `Keine aktive Warnung für ${place}.`,
    }),
    footer: {
      en: 'Not a safety system: rely on the official channels (NINA app, sirens, radio). Source: BBK / NINA (warnung.bund.de), unofficial connector.',
      fr: 'Pas un système de sécurité : fiez-vous aux canaux officiels (application NINA, sirènes, radio). Source : BBK / NINA (warnung.bund.de), connecteur non officiel.',
      de: 'Kein Sicherheitssystem: Verlass dich auf die offiziellen Kanäle (NINA-App, Sirenen, Radio). Quelle: BBK / NINA (warnung.bund.de), inoffizieller Konnektor.',
    },
    // A badge: 16 characters at most.
    allClear: { en: 'All clear', fr: 'Fin d’alerte', de: 'Entwarnung' },
    // The status tile: a label of 24 characters at most.
    tileNone: { en: 'No warning in force', fr: 'Aucun avertissement', de: 'Keine aktive Warnung' },
    tileActive: (count) => ({
      en: count === 1 ? 'Warning in force' : 'Warnings in force',
      fr: count === 1 ? 'Avertissement en cours' : 'Avertissements en cours',
      de: count === 1 ? 'Aktive Warnung' : 'Aktive Warnungen',
    }),
    official: { en: 'Official message', fr: 'Message officiel', de: 'Offizielle Meldung' },
    moreInfo: { en: 'More information', fr: 'Plus d’informations', de: 'Weitere Informationen' },
    sentBy: { en: 'Sent by', fr: 'Émis par', de: 'Herausgegeben von' },
    validUntil: { en: 'Until', fr: 'Jusqu’au', de: 'Bis' },
    detailNote: {
      en: 'Original text in German, unchanged. Source: BBK / NINA (warnung.bund.de).',
      fr: 'Texte original en allemand, inchangé. Source : BBK / NINA (warnung.bund.de).',
      de: 'Originaltext, unverändert. Quelle: BBK / NINA (warnung.bund.de).',
    },
  },
};
