// -----------------------------------------------------------------------------
// Runtime texts shown in Gladys (connection status, buttons, widget) in en/fr,
// and the words of the warnings (severities, sources, summaries) in en/fr/de:
// those follow the `language` of the configuration in the scene variables.
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

export const T = {
  ok: (places, warnings) => ({
    en: `Watching ${plural(places, 'place', 'places')} through NINA: ${plural(warnings, 'warning', 'warnings')} in force.`,
    fr: `${plural(places, 'lieu suivi', 'lieux suivis')} via NINA : ${plural(warnings, 'avertissement', 'avertissements')} en cours.`,
  }),
  noDevice: {
    en: 'Open Discovery and add the NINA device of your house (or of a municipality typed in the configuration).',
    fr: "Ouvrez Découverte et ajoutez l'appareil NINA de votre maison (ou d'une commune saisie dans la configuration).",
  },
  noPlace: {
    en: 'Nothing to watch: set the location of your house in Gladys (Germany only), or type a municipality in the configuration, then open Discovery.',
    fr: "Rien à surveiller : renseignez l'emplacement de votre maison dans Gladys (Allemagne seulement), ou saisissez une commune dans la configuration, puis ouvrez Découverte.",
  },
  unreachable: (message) => ({
    en: `NINA (warnung.bund.de) is unreachable: ${message}. Retrying at the next refresh.`,
    fr: `NINA (warnung.bund.de) est injoignable : ${message}. Nouvel essai au prochain rafraîchissement.`,
  }),
  housesUnavailable: (message) => ({
    en: `The location of the houses is not available (${message}): reinstall the integration and accept the location access, or type a municipality.`,
    fr: `L'emplacement des maisons n'est pas disponible (${message}) : réinstallez l'intégration et acceptez l'accès à la localisation, ou saisissez une commune.`,
  }),
  outside: (house) => ({
    en: `House "${house}" is not in a German municipality: type its municipality in the configuration.`,
    fr: `La maison « ${house} » n'est pas dans une commune allemande : saisissez sa commune dans la configuration.`,
  }),
  unknownPlace: (query) => ({
    en: `Unknown municipality "${query}": the "Search a municipality" button gives the exact names and ARS.`,
    fr: `Commune inconnue « ${query} » : le bouton « Chercher une commune » donne les noms exacts et les ARS.`,
  }),
  ambiguousPlace: (query, matches) => ({
    en: `Several municipalities are named "${query}": type the ARS of yours, or "Name (District)". ${matches.join('; ')}`,
    fr: `Plusieurs communes s'appellent « ${query} » : saisissez l'ARS de la vôtre, ou « Nom (District) ». ${matches.join(' ; ')}`,
  }),
  tooManyPlaces: (max) => ({
    en: `At most ${max} municipalities: the others are ignored.`,
    fr: `Au plus ${max} communes : les autres sont ignorées.`,
  }),
  noMatch: (query) => ({
    en: `No municipality contains "${query}".`,
    fr: `Aucune commune ne contient « ${query} ».`,
  }),
  test: {
    directory: (count) => ({
      en: `NINA answers: ${count} municipalities known.`,
      fr: `NINA répond : ${count} communes connues.`,
    }),
    place: (name, municipality, count) => ({
      en: `${name} → ${municipality}: ${plural(count, 'warning', 'warnings')} in force.`,
      fr: `${name} → ${municipality} : ${plural(count, 'avertissement', 'avertissements')} en cours.`,
    }),
    failed: (name, message) => ({
      en: `${name}: ${message}`,
      fr: `${name} : ${message}`,
    }),
    none: {
      en: 'No house located in Germany and no municipality typed yet.',
      fr: 'Aucune maison localisée en Allemagne et aucune commune saisie pour le moment.',
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
    },
    notLoaded: { en: 'Waiting for the first reading…', fr: 'En attente de la première lecture…' },
    none: (place) => ({
      en: `No warning in force for ${place}.`,
      fr: `Aucun avertissement en cours pour ${place}.`,
    }),
    footer: {
      en: 'Not a safety system: rely on the official channels (NINA app, sirens, radio). Source: BBK / NINA (warnung.bund.de), unofficial connector.',
      fr: 'Pas un système de sécurité : fiez-vous aux canaux officiels (application NINA, sirènes, radio). Source : BBK / NINA (warnung.bund.de), connecteur non officiel.',
    },
    allClear: { en: 'All clear', fr: 'Fin d’alerte' },
    official: { en: 'Official message', fr: 'Message officiel' },
    moreInfo: { en: 'More information', fr: 'Plus d’informations' },
    sentBy: { en: 'Sent by', fr: 'Émis par' },
    validUntil: { en: 'Until', fr: 'Jusqu’au' },
    detailNote: {
      en: 'Original text in German, unchanged. Source: BBK / NINA (warnung.bund.de).',
      fr: 'Texte original en allemand, inchangé. Source : BBK / NINA (warnung.bund.de).',
    },
  },
};
