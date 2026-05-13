// Lig API yardımcıları. Underscore-prefixed dosyalar route edilmez.
// KV binding: TENNIS_DATA. Tek bir key altında tüm lig state'i tutulur.

export const STATE_KEY = 'league:state';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-League-Admin-Password',
};

export const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { 'Content-Type': 'application/json', ...cors, ...(init.headers || {}) },
});

export const options = () => new Response(null, { headers: cors });

export function istanbulISO(offsetDays = 0) {
  const ms = Date.now() + (3 * 3600 * 1000) + (offsetDays * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

export async function readState(env) {
  const raw = await env.TENNIS_DATA.get(STATE_KEY);
  if (!raw) {
    return {
      config: {
        kFactor: 32,
        provisionalK: 64,
        provisionalMatches: 5,
        initialRating: 1200,
        milat: null,
      },
      players: {},
      matches: [],
      updatedAt: 0,
    };
  }
  try {
    const parsed = JSON.parse(raw);
    parsed.config = parsed.config || {};
    parsed.players = parsed.players || {};
    parsed.matches = parsed.matches || [];
    parsed.updatedAt = parsed.updatedAt || 0;
    return parsed;
  } catch {
    return { config: {}, players: {}, matches: [], updatedAt: 0 };
  }
}

export async function writeState(env, state) {
  state.updatedAt = Date.now();
  await env.TENNIS_DATA.put(STATE_KEY, JSON.stringify(state));
  return state;
}

// ELO: yeni puan = eski + K * (sonuc - beklenti). Beklenti karşı tarafa göre.
export function expectedScore(myRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
}

export function effectiveK(player, config) {
  const matches = player.matchesPlayed || 0;
  if (matches < (config.provisionalMatches || 5)) {
    return config.provisionalK || 64;
  }
  return config.kFactor || 32;
}

// Maç sonucunu uygula. Kazanan rating += K_w * (1 - E_w); kaybeden rating += K_l * (0 - E_l)
// Her oyuncunun kendi K'sı kullanılır (provisional ise daha yüksek).
export function applyMatch(state, winnerSlug, loserSlug) {
  const w = state.players[winnerSlug];
  const l = state.players[loserSlug];
  if (!w || !l) throw new Error('player not found');
  const kW = effectiveK(w, state.config);
  const kL = effectiveK(l, state.config);
  const eW = expectedScore(w.rating, l.rating);
  const eL = 1 - eW;
  const wBefore = w.rating;
  const lBefore = l.rating;
  const wDelta = Math.round(kW * (1 - eW));
  const lDelta = Math.round(kL * (0 - eL));
  w.rating = wBefore + wDelta;
  l.rating = lBefore + lDelta;
  w.wins = (w.wins || 0) + 1;
  l.losses = (l.losses || 0) + 1;
  w.matchesPlayed = (w.matchesPlayed || 0) + 1;
  l.matchesPlayed = (l.matchesPlayed || 0) + 1;
  w.lastMatch = istanbulISO(0);
  l.lastMatch = istanbulISO(0);
  return {
    winner: { slug: winnerSlug, before: wBefore, after: w.rating, delta: wDelta, k: kW },
    loser: { slug: loserSlug, before: lBefore, after: l.rating, delta: lDelta, k: kL },
  };
}

export function isAdmin(request, env) {
  const expected = env.LEAGUE_ADMIN_PASSWORD;
  if (!expected) return false;
  const pwd = request.headers.get('X-League-Admin-Password') ||
              (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  return pwd && pwd === expected;
}

export function newMatchId(matches) {
  let max = 0;
  for (const m of matches) {
    const n = parseInt((m.id || '').replace(/^m_/, ''), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return 'm_' + String(max + 1).padStart(4, '0');
}
