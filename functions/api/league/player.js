// POST   /api/league/player   → oyuncu ekle/güncelle (admin only)
// DELETE /api/league/player   → oyuncu sil (admin only). Body: { slug }
import { readState, writeState, json, options, isAdmin } from './_helpers.js';

export const onRequestOptions = options;

function slugify(s) {
  return (s || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function onRequestPost({ env, request }) {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, { status: 401 });
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid json' }, { status: 400 }); }

  const { name, rating, slug: providedSlug, active } = body || {};
  if (!name) return json({ error: 'name zorunlu' }, { status: 400 });
  const slug = providedSlug || slugify(name);
  if (!slug) return json({ error: 'slug üretilemedi' }, { status: 400 });

  const state = await readState(env);
  const existing = state.players[slug];
  const initial = state.config.initialRating || 1200;

  state.players[slug] = {
    name: String(name).slice(0, 60),
    rating: Number.isFinite(rating) ? Math.round(rating) : (existing?.rating ?? initial),
    wins: existing?.wins ?? 0,
    losses: existing?.losses ?? 0,
    matchesPlayed: existing?.matchesPlayed ?? 0,
    active: typeof active === 'boolean' ? active : (existing?.active ?? true),
    lastMatch: existing?.lastMatch ?? null,
  };

  const saved = await writeState(env, state);
  return json({ slug, player: saved.players[slug], state: saved });
}

export async function onRequestDelete({ env, request }) {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, { status: 401 });
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid json' }, { status: 400 }); }
  const { slug } = body || {};
  if (!slug) return json({ error: 'slug zorunlu' }, { status: 400 });

  const state = await readState(env);
  if (!state.players[slug]) return json({ error: 'oyuncu bulunamadı' }, { status: 404 });
  delete state.players[slug];
  const saved = await writeState(env, state);
  return json({ slug, state: saved });
}
