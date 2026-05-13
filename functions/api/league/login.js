// POST /api/league/login → { password } gönderilir, doğruysa { ok: true } döner.
// Token yok; frontend şifreyi localStorage'a koyup her admin isteğinde X-League-Admin-Password header'ı ile yollar.
import { json, options, isAdmin } from './_helpers.js';

export const onRequestOptions = options;

export async function onRequestPost({ env, request }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid json' }, { status: 400 }); }
  const password = body?.password;
  if (!password) return json({ error: 'password zorunlu' }, { status: 400 });

  const headers = new Headers(request.headers);
  headers.set('X-League-Admin-Password', password);
  const fake = new Request(request.url, { headers });
  if (!isAdmin(fake, env)) return json({ error: 'yanlış şifre' }, { status: 401 });

  return json({ ok: true });
}
