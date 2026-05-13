// POST   /api/league/match   → yeni maç ekle (admin only)
// DELETE /api/league/match   → son maçı geri al ve puanları eski haline çevir (admin only)
import {
  readState, writeState, json, options, isAdmin,
  applyMatch, newMatchId, istanbulISO,
} from './_helpers.js';

export const onRequestOptions = options;

export async function onRequestPost({ env, request }) {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, { status: 401 });

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid json' }, { status: 400 }); }

  const { winner, loser, sets, note, date } = body || {};
  if (!winner || !loser) return json({ error: 'winner ve loser zorunlu' }, { status: 400 });
  if (winner === loser) return json({ error: 'aynı oyuncu olamaz' }, { status: 400 });

  const state = await readState(env);
  if (!state.players[winner] || !state.players[loser]) {
    return json({ error: 'oyuncu bulunamadı' }, { status: 400 });
  }

  let result;
  try { result = applyMatch(state, winner, loser); }
  catch (e) { return json({ error: e.message }, { status: 400 }); }

  const match = {
    id: newMatchId(state.matches),
    date: date || istanbulISO(0),
    winner,
    loser,
    sets: Array.isArray(sets) ? sets : [],
    note: typeof note === 'string' ? note.slice(0, 500) : '',
    ratingBefore: { winner: result.winner.before, loser: result.loser.before },
    ratingAfter:  { winner: result.winner.after,  loser: result.loser.after  },
    delta:        { winner: result.winner.delta,  loser: result.loser.delta  },
    kFactor:      { winner: result.winner.k,      loser: result.loser.k      },
    createdAt: Date.now(),
  };
  state.matches.push(match);
  if (state.matches.length > 2000) state.matches = state.matches.slice(-2000);

  const saved = await writeState(env, state);
  return json({ match, state: saved });
}

export async function onRequestDelete({ env, request }) {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, { status: 401 });
  const state = await readState(env);
  const last = state.matches.pop();
  if (!last) return json({ error: 'silinecek maç yok' }, { status: 404 });

  const w = state.players[last.winner];
  const l = state.players[last.loser];
  if (w && last.ratingBefore) {
    w.rating = last.ratingBefore.winner;
    w.wins = Math.max(0, (w.wins || 1) - 1);
    w.matchesPlayed = Math.max(0, (w.matchesPlayed || 1) - 1);
  }
  if (l && last.ratingBefore) {
    l.rating = last.ratingBefore.loser;
    l.losses = Math.max(0, (l.losses || 1) - 1);
    l.matchesPlayed = Math.max(0, (l.matchesPlayed || 1) - 1);
  }
  const saved = await writeState(env, state);
  return json({ removed: last, state: saved });
}
