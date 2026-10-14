// -----------------------------------------------------------------------------
// The integration itself: the municipality directory, the houses located in
// their municipality (the official app's grid and polygons), the typed
// municipalities, discovery, the refresh loop over the devices the user
// created (one dashboard per district, the details once per warning version),
// the scene triggers, the scene action, the widget and the buttons. index.js
// only wires the SDK handlers to it.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import {
  DIRECTORY_TTL,
  GRID_RETRY,
  LIMITS,
  REQUEST_SPACING,
  SNAP_KM,
  STATE_HEARTBEAT,
  WIDGETS,
} from './constants.js';
import {
  DEVICE_KINDS,
  arsOfDevice,
  buildPlaceDevice,
  parseExternalId,
  placeStates,
} from './devices.js';
import { T, severityName } from './i18n.js';
import {
  cut,
  isActive,
  placeReading,
  providerOf,
  revisionOf,
  sourceOf,
  titleOf,
  warningOf,
} from './model.js';
import { NinaClient } from './nina.js';
import {
  buildDirectory,
  concernsPlace,
  containsPoint,
  distanceToOutlineKm,
  gridCell,
  placeLine,
  resolvePlace,
  scanGrid,
  searchPlaces,
} from './places.js';
import { sceneEvents, trackWarnings } from './triggers.js';
import { warningsWidget } from './widget.js';

const defaultTimers = { setTimeout, clearTimeout, setInterval, clearInterval };
const located = (house) => Number.isFinite(house?.latitude) && Number.isFinite(house?.longitude);
const both = (a, b) => ({ en: `${a.en} ${b.en}`, fr: `${a.fr} ${b.fr}` });

export class NinaApp {
  constructor({
    gladys,
    logger = createLogger({ name: 'nina' }),
    now = Date.now,
    timers = defaultTimers,
    sleep,
    client = new NinaClient(),
  }) {
    this.gladys = gladys;
    this.logger = logger;
    this.now = now;
    this.timers = timers;
    this.sleep = sleep ?? ((ms) => new Promise((resolve) => this.timers.setTimeout(resolve, ms)));
    this.client = client;
    this.config = normalizeConfig();
    this.directory = undefined;
    this.directoryAt = 0;
    /** What was read in the grid file: cell -> municipalities, municipality -> cells. */
    this.grid = { candidates: new Map(), cellsOf: new Map(), at: 0 };
    /** zid -> GeoJSON geometry of the municipalities tried for a house. */
    this.polygons = new Map();
    /** house selector -> { house, cell, place, error } */
    this.houses = new Map();
    this.housesError = undefined;
    /** The typed municipalities: [{ query, place } | { query, error, matches }] */
    this.typed = [];
    /** district ARS -> { etag, items }: the last dashboard (conditional GET). */
    this.dashboards = new Map();
    /** warning id -> { revision, details }: read once per version. */
    this.details = new Map();
    /** device external id -> reading / tracked warnings. Kept across restarts. */
    this.readings = new Map();
    this.trackers = new Map();
    this.trackedSources = undefined;
    this.prepared = false;
    this.refreshTimer = undefined;
    this.refreshing = undefined;
    this.lastStatus = undefined;
    this.generation = 0;
    /** Spacing of the requests: the first one of a burst goes at once. */
    this.lastRequestAt = -Infinity;
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(raw = {}) {
    this.stop();
    const generation = ++this.generation;
    this.config = normalizeConfig(raw);
    this.prepared = false;
    const sources = this.config.sources.join(',');
    if (this.trackedSources !== undefined && this.trackedSources !== sources) {
      // Another set of sources: what disappears was filtered, not withdrawn.
      this.trackers.clear();
      this.readings.clear();
    }
    this.trackedSources = sources;
    if (this.config.droppedMunicipalities > 0) {
      this.logger.warn(T.tooManyPlaces(this.config.municipalities.length).en);
    }
    try {
      await this.prepare();
      await this.refresh();
    } catch (err) {
      await this.setStatus(false, T.unreachable(err.message));
    }
    if (generation !== this.generation) {
      return;
    }
    this.refreshTimer = this.timers.setInterval(
      () => this.refresh().catch((err) => this.setStatus(false, T.unreachable(err.message))),
      this.config.pollInterval * 60_000,
    );
  }

  stop() {
    this.generation += 1;
    this.timers.clearInterval(this.refreshTimer);
    this.refreshTimer = undefined;
  }

  async setStatus(connected, message) {
    const key = JSON.stringify([connected, message ?? null]);
    if (key === this.lastStatus) {
      return;
    }
    this.lastStatus = key;
    await this.gladys
      .setConnectionStatus(connected, message)
      .catch((err) => this.logger.warn(`setConnectionStatus failed: ${err.message}`));
  }

  /** Polite pacing: at least REQUEST_SPACING between two requests to warnung.bund.de. */
  async paced(request) {
    const wait = this.lastRequestAt + REQUEST_SPACING - this.now();
    if (wait > 0) {
      await this.sleep(wait);
    }
    this.lastRequestAt = this.now();
    return request();
  }

  // --- Directory, grid, houses -----------------------------------------------------

  /** The municipality and district files of the official app, kept a day. */
  async loadDirectory() {
    if (this.directory && this.now() - this.directoryAt < DIRECTORY_TTL) {
      return this.directory;
    }
    try {
      const municipalities = await this.paced(() => this.client.municipalities());
      const districts = await this.paced(() => this.client.districts());
      const directory = buildDirectory(municipalities, districts);
      if (directory.municipalities.size === 0) {
        throw new Error('empty municipality list');
      }
      if (this.directory) {
        // A new list may renumber the municipalities: forget what used the
        // old ids, and find the houses' municipalities again by their ARS.
        this.grid = { candidates: new Map(), cellsOf: new Map(), at: 0 };
        this.polygons.clear();
        for (const entry of this.houses.values()) {
          entry.place = entry.place && resolvePlace(directory, entry.place.ars).place;
        }
      }
      this.directory = directory;
      this.directoryAt = this.now();
    } catch (err) {
      if (!this.directory) {
        throw err;
      }
      this.logger.warn(`Municipality list not refreshed, keeping the old one: ${err.message}`);
    }
    return this.directory;
  }

  /**
   * Read the grid file for the cells and municipalities not known yet (the
   * houses to locate, the places a GRID warning must be matched with). At
   * most once per GRID_RETRY: what is still missing then is not in the file.
   */
  async ensureGrid({ cells = [], zids = [] }) {
    const missingCells = cells.filter((c) => c !== null && !this.grid.candidates.has(c));
    const missingZids = zids.filter((z) => z !== null && !this.grid.cellsOf.has(z));
    if (missingCells.length === 0 && missingZids.length === 0) {
      return;
    }
    if (this.now() - this.grid.at < GRID_RETRY) {
      return;
    }
    const text = await this.paced(() => this.client.gridText());
    this.grid.at = this.now();
    const { candidates, cellsOf } = scanGrid(text, { cells: missingCells, zids: missingZids });
    for (const cell of missingCells) {
      this.grid.candidates.set(cell, candidates.get(cell) ?? []);
    }
    for (const [zid, set] of cellsOf) {
      this.grid.cellsOf.set(zid, set);
    }
  }

  async polygon(zid) {
    if (!this.polygons.has(zid)) {
      const feature = await this.paced(() => this.client.polygon(zid));
      this.polygons.set(zid, feature?.geometry ?? feature);
    }
    return this.polygons.get(zid);
  }

  /**
   * The municipality of a house, as the official app finds it for a point:
   * the municipalities of its grid cell, then the one whose outline holds it
   * (the outlines are simplified: a house in a gap belongs to the nearest one
   * within SNAP_KM).
   */
  async locate(entry) {
    if (!this.grid.candidates.has(entry.cell)) {
      throw new Error('the grid of the municipalities is not available');
    }
    const candidates = this.grid.candidates
      .get(entry.cell)
      .map((zid) => this.directory.municipalities.get(zid))
      .filter(Boolean);
    const point = [entry.house.longitude, entry.house.latitude];
    let nearest;
    for (const municipality of candidates) {
      const geometry = await this.polygon(municipality.zid);
      if (containsPoint(geometry, point)) {
        return municipality;
      }
      const km = distanceToOutlineKm(geometry, point);
      if (!nearest || km < nearest.km) {
        nearest = { municipality, km };
      }
    }
    return nearest && nearest.km <= SNAP_KM ? nearest.municipality : undefined;
  }

  /** The located houses of Gladys, each in its municipality (kept while it does not move). */
  async loadHouses() {
    let houses;
    try {
      houses = await this.gladys.getHouses();
      this.housesError = undefined;
    } catch (err) {
      this.housesError = err.message;
      this.logger.warn(`Houses unavailable (location not granted?): ${err.message}`);
      return;
    }
    const entries = new Map();
    for (const house of houses ?? []) {
      if (!located(house)) {
        continue;
      }
      const known = this.houses.get(house.selector);
      const same =
        known?.place &&
        known.house.latitude === house.latitude &&
        known.house.longitude === house.longitude;
      entries.set(
        house.selector,
        same
          ? { ...known, house }
          : { house, cell: gridCell(house.latitude, house.longitude), place: undefined },
      );
    }
    this.houses = entries;
    const pending = [...entries.values()].filter((e) => !e.place && e.cell !== null);
    if (pending.length > 0) {
      await this.ensureGrid({ cells: pending.map((e) => e.cell) }).catch((err) =>
        this.logger.warn(`Grid unavailable, houses not located: ${err.message}`),
      );
    }
    for (const entry of pending) {
      try {
        const municipality = await this.locate(entry);
        entry.place = municipality
          ? resolvePlace(this.directory, municipality.ars).place
          : undefined;
        entry.error = municipality ? undefined : 'outside';
      } catch (err) {
        entry.error = err.message;
        this.logger.warn(`Locating ${entry.house.name} failed: ${err.message}`);
      }
    }
    for (const entry of entries.values()) {
      if (entry.cell === null) {
        entry.error = 'outside';
      }
      if (entry.error === 'outside') {
        this.logger.warn(T.outside(entry.house.name).en);
      }
    }
  }

  resolveTyped() {
    this.typed = this.config.municipalities.map((query) => {
      const result = resolvePlace(this.directory, query);
      if (result.error) {
        const message =
          result.error === 'ambiguous'
            ? T.ambiguousPlace(query, result.matches)
            : T.unknownPlace(query);
        this.logger.warn(message.en);
      }
      return { query, ...result };
    });
  }

  // --- Discovery -----------------------------------------------------------------

  /** Directory, houses, typed municipalities, then the devices offered in Discovery. */
  async prepare() {
    await this.loadDirectory();
    this.resolveTyped();
    await this.loadHouses();
    await this.gladys.publishDiscoveredDevices(this.discoveredDevices());
    this.prepared = true;
  }

  discoveredDevices() {
    const devices = [];
    for (const [selector, entry] of this.houses) {
      if (entry.place) {
        devices.push(
          buildPlaceDevice(this.gladys, {
            kind: DEVICE_KINDS.HOUSE,
            selector,
            houseName: entry.house.name,
            place: entry.place,
          }),
        );
      }
    }
    const seen = new Set();
    for (const { place } of this.typed) {
      if (place && !seen.has(place.ars)) {
        seen.add(place.ars);
        devices.push(buildPlaceDevice(this.gladys, { kind: DEVICE_KINDS.PLACE, place }));
      }
    }
    return devices;
  }

  /** Discovery asked by the user: the houses may have moved since the start. */
  async scan() {
    await this.prepare();
  }

  /** The places of the devices the user created: what the loop reads. */
  watchedPlaces() {
    const watched = [];
    for (const device of this.gladys.devices ?? []) {
      const parsed = parseExternalId(device.external_id);
      if (!parsed) {
        continue;
      }
      const fromArs = (ars) =>
        ars && this.directory ? resolvePlace(this.directory, ars).place : undefined;
      const place =
        parsed.kind === DEVICE_KINDS.HOUSE
          ? (this.houses.get(parsed.selector)?.place ?? fromArs(arsOfDevice(device)))
          : fromArs(parsed.ars);
      if (place) {
        watched.push({ deviceId: device.external_id, name: device.name, place });
      } else {
        this.logger.debug(`No municipality for ${device.name}: skipped`);
      }
    }
    return watched;
  }

  async deviceCreated(device) {
    if (parseExternalId(device?.external_id)) {
      await this.refresh().catch((err) => this.logger.warn(`Reading failed: ${err.message}`));
    }
  }

  async deviceDeleted(device) {
    this.readings.delete(device?.external_id);
    this.trackers.delete(device?.external_id);
  }

  // --- Reading -------------------------------------------------------------------

  refresh() {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = undefined;
      });
    }
    return this.refreshing;
  }

  /** The dashboard of a district, reusing the last one when NINA answers 304. */
  async readDashboard(districtArs) {
    const cached = this.dashboards.get(districtArs);
    const answer = await this.paced(() => this.client.dashboard(districtArs, cached?.etag));
    if (answer.notModified && cached) {
      return cached.items;
    }
    const items = Array.isArray(answer.body) ? answer.body : [];
    this.dashboards.set(districtArs, { etag: answer.etag, items });
    return items;
  }

  /** The items of a district dashboard that concern a place and a kept source. */
  relevantItems(place, items) {
    return items.filter(
      (item) =>
        concernsPlace(item?.payload?.data?.area, place, this.grid.cellsOf) !== false &&
        this.config.sources.includes(sourceOf(providerOf(item))),
    );
  }

  /** The details of an item, read once per version (a 404 is remembered too). */
  async detailsOf(item) {
    const id = String(item?.id ?? '');
    const revision = revisionOf(item);
    const cached = this.details.get(id);
    if (cached?.revision === revision) {
      return cached.details;
    }
    try {
      const details = await this.paced(() => this.client.warning(id));
      this.details.set(id, { revision, details });
      return details;
    } catch (err) {
      this.logger.warn(`Details of ${id} unavailable: ${err.message}`);
      if (err.status === 404) {
        this.details.set(id, { revision, details: undefined });
      }
      return undefined;
    }
  }

  async doRefresh() {
    const generation = this.generation;
    if (!this.prepared) {
      // The start failed (NINA unreachable): locate the houses and publish
      // Discovery as soon as NINA answers again.
      await this.prepare().catch((err) => this.logger.warn(`Discovery failed: ${err.message}`));
    }
    await this.loadDirectory();
    const watched = this.watchedPlaces();
    if (watched.length === 0) {
      await this.statusWithoutDevice();
      return;
    }
    let failure;
    const dashboards = new Map();
    for (const districtArs of new Set(watched.map((w) => w.place.districtArs))) {
      try {
        dashboards.set(districtArs, await this.readDashboard(districtArs));
      } catch (err) {
        failure = err;
        this.logger.warn(`Reading the warnings of ${districtArs} failed: ${err.message}`);
      }
      if (generation !== this.generation) {
        return;
      }
    }
    // GRID warnings need the cells of the municipality (the grid file, once).
    const unknownCells = watched.filter((w) =>
      (dashboards.get(w.place.districtArs) ?? []).some(
        (item) => concernsPlace(item?.payload?.data?.area, w.place, this.grid.cellsOf) === null,
      ),
    );
    if (unknownCells.length > 0) {
      await this.ensureGrid({ zids: unknownCells.map((w) => w.place.zid) }).catch((err) =>
        this.logger.warn(`Grid unavailable, GRID warnings kept district-wide: ${err.message}`),
      );
    }
    const relevant = new Map();
    for (const w of watched) {
      if (dashboards.has(w.place.districtArs)) {
        relevant.set(w.deviceId, this.relevantItems(w.place, dashboards.get(w.place.districtArs)));
      }
    }
    const details = new Map();
    for (const item of [...relevant.values()].flat()) {
      if (!details.has(item.id)) {
        details.set(item.id, await this.detailsOf(item));
      }
      if (generation !== this.generation) {
        return;
      }
    }
    if (!failure) {
      // Forget the details of the warnings no dashboard lists any more.
      for (const id of this.details.keys()) {
        if (!details.has(id)) {
          this.details.delete(id);
        }
      }
    }
    const now = this.now();
    let total = 0;
    for (const w of watched) {
      if (!relevant.has(w.deviceId)) {
        continue;
      }
      const warnings = relevant
        .get(w.deviceId)
        .map((item) => warningOf(item, details.get(item.id)));
      total += await this.publishReading(w, placeReading(warnings, now), now);
    }
    if (failure) {
      await this.setStatus(this.readings.size > 0, T.unreachable(failure.message));
    } else {
      const typedError = this.typedError();
      const ok = T.ok(watched.length, total);
      await this.setStatus(true, typedError ? both(ok, typedError) : ok);
    }
  }

  /** States, scene events and widget nudge of one place. Returns its count. */
  async publishReading(w, reading, now) {
    const previous = this.readings.get(w.deviceId);
    const { tracked, transitions } = trackWarnings(this.trackers.get(w.deviceId), reading, now);
    this.trackers.set(w.deviceId, tracked);
    this.readings.set(w.deviceId, reading);
    await this.gladys
      .publishChangedStates(placeStates(w.deviceId, reading, this.config.language), {
        heartbeat: STATE_HEARTBEAT,
      })
      .catch((err) => this.logger.warn(`States of ${w.name} failed: ${err.message}`));
    const events = sceneEvents(transitions, {
      deviceId: w.deviceId,
      placeName: w.place.name,
      language: this.config.language,
      now,
    });
    for (const event of events) {
      await this.gladys
        .publishSceneEvent(event.key, event.data)
        .catch((err) => this.logger.warn(`Scene event ${event.key} failed: ${err.message}`));
    }
    const signature = (r) =>
      JSON.stringify([...r.active, ...r.allClear].map((x) => [x.id, x.revision, x.detailed]));
    if (!previous || signature(previous) !== signature(reading)) {
      this.gladys.requestWidgetRefresh(WIDGETS.WARNINGS);
    }
    return reading.count;
  }

  typedError() {
    const failed = this.typed.find((t) => t.error);
    if (!failed) {
      return undefined;
    }
    return failed.error === 'ambiguous'
      ? T.ambiguousPlace(failed.query, failed.matches)
      : T.unknownPlace(failed.query);
  }

  async statusWithoutDevice() {
    const offered =
      [...this.houses.values()].some((e) => e.place) || this.typed.some((t) => t.place);
    if (offered) {
      await this.setStatus(true, T.noDevice);
      return;
    }
    if (this.housesError) {
      await this.setStatus(false, T.housesUnavailable(this.housesError));
      return;
    }
    const outside = [...this.houses.values()].find((e) => e.error === 'outside');
    const typedError = this.typedError();
    await this.setStatus(
      false,
      typedError ?? (outside ? T.outside(outside.house.name) : T.noPlace),
    );
  }

  // --- Scene action ------------------------------------------------------------------

  watchedOf(externalId) {
    const watched = this.watchedPlaces().find((w) => w.deviceId === externalId);
    if (!watched) {
      throw new Error(`Unknown NINA device ${externalId}`);
    }
    return watched;
  }

  /**
   * "NINA warnings": the last reading of a place (no request, no event; the
   * very first reading is made here if the loop has not run yet).
   */
  async getWarnings(fields = {}) {
    const watched = this.watchedOf(fields.house);
    if (!this.readings.has(watched.deviceId)) {
      await this.refresh();
    }
    const reading = this.readings.get(watched.deviceId);
    if (!reading) {
      throw new Error('NINA could not be read: see the status of the integration');
    }
    const language = this.config.language;
    const lines = reading.active.map(
      (w) => `${titleOf(w, language)} (${severityName(w.severity, language)}, ${w.providerName})`,
    );
    const place = watched.place.name;
    const pickLang = (text) => text[language] ?? text.en;
    const summary =
      reading.count === 0
        ? pickLang(T.summary.none(place))
        : `${pickLang(T.summary.some(place, reading.count))} ${lines.join('; ')}.`;
    return {
      place,
      count: reading.count,
      highest_severity: reading.highest,
      highest_severity_name: severityName(reading.highest, language),
      titles: cut(lines.join('\n'), 4 * LIMITS.text),
      summary: cut(summary, 4 * LIMITS.text),
    };
  }

  // --- Widget ---------------------------------------------------------------------

  async getWidget({ settings = {}, language } = {}) {
    const lang = language ?? this.config.language;
    const watched = this.watchedPlaces().find((w) => w.deviceId === settings.house);
    if (!watched) {
      return {
        ttl_seconds: 300,
        components: [{ type: 'text', text: T.widget.pickHouse, variant: 'body' }],
      };
    }
    return warningsWidget({
      name: watched.name,
      placeName: watched.place.name,
      reading: this.readings.get(watched.deviceId),
      language: lang,
    });
  }

  // --- Configuration screen buttons --------------------------------------------------

  async testConnection() {
    try {
      await this.prepare();
    } catch (err) {
      return T.unreachable(err.message);
    }
    const lines = { en: [], fr: [] };
    const add = (text) => {
      lines.en.push(text.en);
      lines.fr.push(text.fr);
    };
    add(T.test.directory(this.directory.municipalities.size));
    const targets = [];
    for (const entry of this.houses.values()) {
      if (entry.place) {
        targets.push({ name: entry.house.name, place: entry.place });
      } else {
        add(
          entry.error === 'outside'
            ? T.outside(entry.house.name)
            : T.test.failed(entry.house.name, entry.error),
        );
      }
    }
    for (const typed of this.typed) {
      if (typed.place) {
        targets.push({ name: typed.query, place: typed.place });
      } else {
        add(
          typed.error === 'ambiguous'
            ? T.ambiguousPlace(typed.query, typed.matches)
            : T.unknownPlace(typed.query),
        );
      }
    }
    if (this.housesError) {
      add(T.housesUnavailable(this.housesError));
    }
    if (targets.length === 0 && this.houses.size === 0 && this.typed.length === 0) {
      add(T.test.none);
    }
    for (const { name, place } of targets) {
      try {
        const items = this.relevantItems(place, await this.readDashboard(place.districtArs));
        const count = items
          .map((item) => warningOf(item))
          .filter((w) => isActive(w, this.now())).length;
        add(T.test.place(name, placeLine(place), count));
      } catch (err) {
        add(T.test.failed(name, err.message));
      }
    }
    return { en: lines.en.join('\n'), fr: lines.fr.join('\n') };
  }

  async searchMunicipality(fields = {}) {
    const query = String(fields.query ?? '').trim();
    const directory = await this.loadDirectory();
    const matches = searchPlaces(directory, query).map(placeLine);
    if (matches.length === 0) {
      return T.noMatch(query);
    }
    return { en: matches.join('\n'), fr: matches.join('\n') };
  }
}
