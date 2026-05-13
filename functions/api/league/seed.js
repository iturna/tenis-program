// POST /api/league/seed → seed.json'daki oyuncuları KV'ye yükler (admin only).
// State boşsa veya body.force=true ise yapar; aksi takdirde reddeder.
import { readState, writeState, json, options, isAdmin, istanbulISO } from './_helpers.js';

const SEED_URL = '/league/seed.json';

export const onRequestOptions = options;

export async function onRequestPost({ env, request }) {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;

  const state = await readState(env);
  const hasData = Object.keys(state.players).length > 0 || state.matches.length > 0;
  if (hasData && !force) {
    return json({ error: 'state dolu, force=true ile çağır' }, { status: 409 });
  }

  const url = new URL(SEED_URL, request.url);
  const res = await fetch(url.toString());
  if (!res.ok) return json({ error: 'seed.json okunamadı' }, { status: 500 });
  const seed = await res.json();

  state.config = {
    kFactor: seed.kFactor ?? 32,
    provisionalK: seed.provisionalK ?? 64,
    provisionalMatches: seed.provisionalMatches ?? 5,
    initialRating: seed.initialRating ?? 1200,
    milat: seed.milat || istanbulISO(0),
    scaling: seed.scaling || '',
  };
  state.players = {};
  for (const p of seed.players || []) {
    state.players[p.slug] = {
      name: p.name,
      rating: p.rating,
      wins: 0,
      losses: 0,
      matchesPlayed: 0,
      active: true,
      lastMatch: null,
      seedPuan: p.puan,
    };
  }
  state.matches = [];

  const saved = await writeState(env, state);
  return json({ ok: true, playerCount: Object.keys(saved.players).length, state: saved });
}
