// -----------------------------------------------------------------------------
// The NINA client: the warnings of a district (dashboard), the details of a
// warning, and the municipality files of the official web app. Raw JSON:
// turning it into warnings and places is src/model.js and src/places.js.
// -----------------------------------------------------------------------------

import { NINA_API, NINA_ASSETS } from './constants.js';
import { getJson, getJsonConditional, getText } from './http.js';

export class NinaClient {
  constructor({ api = NINA_API, assets = NINA_ASSETS } = {}) {
    this.api = api;
    this.assets = assets;
  }

  /**
   * The warnings of a district, every source. NINA serves districts only:
   * the 5 first digits of the ARS then "0000000" (a municipality is a 404).
   * With the ETag of the previous answer, `{ notModified: true }` when
   * nothing changed.
   */
  dashboard(districtArs, etag) {
    return getJsonConditional(`${this.api}/dashboard/${districtArs}.json`, etag);
  }

  /** The CAP details of a warning (every language block, the references). */
  warning(id) {
    return getJson(`${this.api}/warnings/${encodeURIComponent(id)}.json`);
  }

  /** { zid: { RS, NAME, KFS, PKT, EWZ } }, about 11,000 municipalities (250 KB gzip). */
  municipalities() {
    return getJson(`${this.assets}/converted_gemeinden.json`);
  }

  /** { "05334": { NAME, PKT, KFS?, EWZ } }, the 400 districts. */
  districts() {
    return getJson(`${this.assets}/converted_kreise.json`);
  }

  /**
   * The grid cell -> municipalities mapping as TEXT (5.7 MB, 1 MB gzip): it
   * is scanned for the few cells and municipalities needed, never parsed
   * into 300,000 objects.
   */
  gridText() {
    return getText(`${this.assets}/grid_zgem_mapping.json`, { timeout: 60_000 });
  }

  /** The (simplified) outline of one municipality: a GeoJSON Feature. */
  polygon(zid) {
    return getJson(`${this.assets}/gemeinden_polygons/${Number(zid)}.geojson`);
  }
}
