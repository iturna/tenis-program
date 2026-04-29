// Pages Function: /api/day/{date}
// GET   → returns { reservations, history, updatedAt }
// POST  → applies ops { upsert, delete, history }, returns updated state
//
// KV binding: TENNIS_DATA (configured in wrangler.toml)

const KEY = (date) => `day:${date}`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
};

const empty = () => ({ reservations: {}, history: [], updatedAt: 0 });

const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

async function read(env, date) {
  const raw = await env.TENNIS_DATA.get(KEY(date));
  if (!raw) return empty();
  try {
    const parsed = JSON.parse(raw);
    parsed.reservations = parsed.reservations || {};
    parsed.history = parsed.history || [];
    parsed.updatedAt = parsed.updatedAt || 0;
    return parsed;
  } catch {
    return empty();
  }
}

async function write(env, date, state) {
  state.updatedAt = Date.now();
  await env.TENNIS_DATA.put(KEY(date), JSON.stringify(state));
  return state;
}

const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { 'Content-Type': 'application/json', ...cors, ...(init.headers || {}) },
});

export const onRequestOptions = () => new Response(null, { headers: cors });

export async function onRequestGet({ params, env, request }) {
  if (!isISODate(params.date)) return json({ error: 'invalid date' }, { status: 400 });
  const state = await read(env, params.date);
  const etag = `"v${state.updatedAt}"`;
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, ...cors } });
  }
  return json(state, { headers: { ETag: etag } });
}

export async function onRequestPost({ params, env, request }) {
  if (!isISODate(params.date)) return json({ error: 'invalid date' }, { status: 400 });
  const date = params.date;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }

  const state = await read(env, date);

  const ops = Array.isArray(body.ops) ? body.ops : [body];
  for (const op of ops) {
    if (op.upsert && op.upsert.date === date && op.upsert.court && op.upsert.time) {
      const r = op.upsert;
      state.reservations[`${r.date}|${r.court}|${r.time}`] = r;
    }
    if (op.delete && op.delete.date === date && op.delete.court && op.delete.time) {
      const d = op.delete;
      delete state.reservations[`${d.date}|${d.court}|${d.time}`];
    }
    if (op.history && op.history.date === date) {
      state.history.push(op.history);
    }
  }
  if (state.history.length > 500) state.history = state.history.slice(-500);

  const newState = await write(env, date, state);
  const etag = `"v${newState.updatedAt}"`;
  return json(newState, { headers: { ETag: etag } });
}
