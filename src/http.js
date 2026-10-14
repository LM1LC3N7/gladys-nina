// -----------------------------------------------------------------------------
// The only place that talks to the network: `fetch` with a timeout and the
// User-Agent, plain or conditional (ETag). The tests replace it with
// `setFetch()`.
// -----------------------------------------------------------------------------

import { HTTP_TIMEOUT, USER_AGENT } from './constants.js';

let fetchImpl = (...args) => globalThis.fetch(...args);

/** Replace the fetch implementation (tests only). Returns the previous one. */
export function setFetch(impl) {
  const previous = fetchImpl;
  fetchImpl = impl;
  return previous;
}

export class HttpError extends Error {
  constructor(status, url) {
    // The path only: the host is always warnung.bund.de, the query is empty.
    super(`HTTP ${status} on ${new URL(url).pathname}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

async function request(url, { etag, raw = false, timeout = HTTP_TIMEOUT } = {}) {
  const headers = { 'User-Agent': USER_AGENT, Accept: 'application/json' };
  if (etag) {
    headers['If-None-Match'] = etag;
  }
  let response;
  try {
    response = await fetchImpl(url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(Math.max(1, timeout)),
    });
  } catch (err) {
    const reason = err?.name === 'TimeoutError' ? 'timeout' : (err?.cause?.code ?? err?.message);
    throw new Error(`${new URL(url).pathname}: ${reason}`, { cause: err });
  }
  if (response.status === 304) {
    return { notModified: true, etag };
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new HttpError(response.status, url);
  }
  const text = await response.text();
  if (raw) {
    return { notModified: false, body: text, etag: response.headers.get('etag') ?? undefined };
  }
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    throw new Error(`${new URL(url).pathname}: not JSON`);
  }
  return { notModified: false, body, etag: response.headers.get('etag') ?? undefined };
}

/** GET a JSON document; throws an HttpError on a non-2xx status. */
export async function getJson(url, options) {
  return (await request(url, options)).body;
}

/** GET a document as text (a large JSON file scanned rather than parsed). */
export async function getText(url, options = {}) {
  return (await request(url, { ...options, raw: true })).body ?? '';
}

/**
 * GET a JSON document with `If-None-Match`: `{ notModified: true }` when the
 * server answers 304, else `{ body, etag }`.
 */
export function getJsonConditional(url, etag, options = {}) {
  return request(url, { ...options, etag });
}
