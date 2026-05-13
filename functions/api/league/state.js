// GET /api/league/state → tüm lig state'i (oyuncular, son maçlar, config)
import { readState, json, options, cors } from './_helpers.js';

export const onRequestOptions = options;

export async function onRequestGet({ env, request }) {
  const state = await readState(env);
  const etag = `"v${state.updatedAt}"`;
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, ...cors } });
  }
  return json(state, { headers: { ETag: etag } });
}
