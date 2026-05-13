// Tenis Ligi UI logic. Single-file vanilla JS, polls state from /api/league/state.

const API = '/api/league';
const PWD_KEY = 'league_admin_pwd';

const state = {
  config: {},
  players: {},
  matches: [],
  updatedAt: 0,
};

// ───── Auth helpers ─────
const getPwd = () => localStorage.getItem(PWD_KEY) || '';
const setPwd = (p) => localStorage.setItem(PWD_KEY, p);
const clearPwd = () => localStorage.removeItem(PWD_KEY);

const adminHeaders = () => ({
  'Content-Type': 'application/json',
  'X-League-Admin-Password': getPwd(),
});

// ───── API ─────
async function fetchState() {
  const res = await fetch(`${API}/state`, { cache: 'no-store' });
  if (!res.ok) throw new Error('state alınamadı');
  const data = await res.json();
  Object.assign(state, data);
  render();
}

async function login(password) {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'giriş başarısız');
  }
  setPwd(password);
}

async function submitMatch(payload) {
  const res = await fetch(`${API}/match`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'maç kaydedilemedi');
  }
  return res.json();
}

async function undoLastMatch() {
  const res = await fetch(`${API}/match`, {
    method: 'DELETE',
    headers: adminHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'geri alınamadı');
  }
  return res.json();
}

async function addPlayer(payload) {
  const res = await fetch(`${API}/player`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'oyuncu eklenemedi');
  }
  return res.json();
}

async function runSeed() {
  const res = await fetch(`${API}/seed`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'seed başarısız');
  return data;
}

// ───── ELO preview ─────
function expected(a, b) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}
function effectiveK(player) {
  const m = player?.matchesPlayed || 0;
  const prov = state.config.provisionalMatches || 5;
  if (m < prov) return state.config.provisionalK || 64;
  return state.config.kFactor || 32;
}
function previewDeltas(winnerSlug, loserSlug) {
  const w = state.players[winnerSlug];
  const l = state.players[loserSlug];
  if (!w || !l) return null;
  const eW = expected(w.rating, l.rating);
  const kW = effectiveK(w);
  const kL = effectiveK(l);
  const wDelta = Math.round(kW * (1 - eW));
  const lDelta = Math.round(kL * (0 - (1 - eW)));
  return {
    winner: { name: w.name, before: w.rating, after: w.rating + wDelta, delta: wDelta, k: kW },
    loser:  { name: l.name, before: l.rating, after: l.rating + lDelta, delta: lDelta, k: kL },
  };
}

// ───── Sorted players ─────
function sortedPlayers() {
  return Object.entries(state.players)
    .map(([slug, p]) => ({ slug, ...p }))
    .sort((a, b) => (b.rating - a.rating) || a.name.localeCompare(b.name, 'tr'));
}

// ───── Render: Piramit ─────
function renderPyramid() {
  const root = document.getElementById('pyramid');
  root.innerHTML = '';
  const players = sortedPlayers().filter(p => p.active !== false);
  if (!players.length) {
    root.innerHTML = '<p class="hint">Henüz oyuncu yok. Admin sekmesinden seed çalıştır.</p>';
    return;
  }
  // Slot dağılımı: 1, 2, 3, 4... mevcut oyuncuyu doldurana kadar
  let idx = 0;
  let rowSize = 1;
  while (idx < players.length) {
    const row = document.createElement('div');
    row.className = 'pyramid-row';
    const take = Math.min(rowSize, players.length - idx);
    for (let i = 0; i < take; i++) {
      const p = players[idx + i];
      const slot = document.createElement('div');
      slot.className = 'pyramid-slot';
      slot.innerHTML = `<div class="name">${escape(p.name)}</div>
                        <div class="rating">${p.rating}</div>`;
      row.appendChild(slot);
    }
    root.appendChild(row);
    idx += take;
    rowSize++;
  }
}

// ───── Render: Sıralama ─────
function renderLeaderboard() {
  const tbody = document.querySelector('#leaderboard tbody');
  const filter = (document.getElementById('searchInput').value || '').toLocaleLowerCase('tr');
  tbody.innerHTML = '';
  const players = sortedPlayers().filter(p => !filter || p.name.toLocaleLowerCase('tr').includes(filter));
  players.forEach((p, i) => {
    const tr = document.createElement('tr');
    const prov = (p.matchesPlayed || 0) < (state.config.provisionalMatches || 5);
    if (prov) tr.classList.add('provisional');
    const total = (p.wins || 0) + (p.losses || 0);
    const pct = total ? Math.round((p.wins || 0) / total * 100) + '%' : '—';
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escape(p.name)}</td>
      <td class="num"><strong>${p.rating}</strong></td>
      <td class="num">${p.wins || 0}</td>
      <td class="num">${p.losses || 0}</td>
      <td class="num">${pct}</td>
      <td class="num">${p.lastMatch || '—'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ───── Render: Maçlar ─────
function renderMatches() {
  const root = document.getElementById('matches');
  const empty = document.getElementById('matches-empty');
  root.innerHTML = '';
  const matches = [...(state.matches || [])].reverse();
  empty.classList.toggle('hidden', matches.length > 0);
  for (const m of matches) {
    const li = document.createElement('li');
    li.className = 'match-card';
    const w = state.players[m.winner];
    const l = state.players[m.loser];
    const wName = w?.name || m.winner;
    const lName = l?.name || m.loser;
    const sets = (m.sets || []).filter(s => Array.isArray(s) && s.length === 2 && (s[0] || s[1]))
                               .map(s => `${s[0]}-${s[1]}`).join(', ');
    li.innerHTML = `
      <div class="match-head"><span>${escape(m.date)}</span><span>#${escape(m.id)}</span></div>
      <div class="match-players">
        <div class="match-player winner">
          ${escape(wName)}
          <div class="delta gain">${m.ratingBefore?.winner} → ${m.ratingAfter?.winner} (+${m.delta?.winner})</div>
        </div>
        <div class="match-vs">yendi</div>
        <div class="match-player">
          ${escape(lName)}
          <div class="delta loss">${m.ratingBefore?.loser} → ${m.ratingAfter?.loser} (${m.delta?.loser})</div>
        </div>
      </div>
      ${sets ? `<div class="match-sets">${escape(sets)}</div>` : ''}
      ${m.note ? `<div class="match-note">${escape(m.note)}</div>` : ''}
    `;
    root.appendChild(li);
  }
}

// ───── Render: Bilgi ─────
function renderInfo() {
  const k = state.config.kFactor || 32;
  const prov = state.config.provisionalMatches || 5;
  const provK = state.config.provisionalK || 64;
  document.getElementById('info-k').textContent = k;
  document.getElementById('info-prov').textContent = prov;
  document.getElementById('info-provk').textContent = provK;
  document.getElementById('info-milat').textContent = state.config.milat || '—';

  // Örnek hesap: A=1200, B=1600, K=32
  const eA = expected(1200, 1600);
  const w1 = Math.round(32 * (1 - eA));
  const w2 = Math.round(32 * (1 - (1 - eA)));
  document.getElementById('info-w1').textContent = w1;
  document.getElementById('info-w1b').textContent = w1;
  document.getElementById('info-w2').textContent = w2;
  document.getElementById('info-w2b').textContent = w2;
}

// ───── Render: Admin ─────
function renderAdmin() {
  const isLoggedIn = !!getPwd();
  document.getElementById('admin-login').classList.toggle('hidden', isLoggedIn);
  document.getElementById('admin-panel').classList.toggle('hidden', !isLoggedIn);
  if (!isLoggedIn) return;

  // Maç formundaki oyuncu seçicileri doldur
  const players = sortedPlayers();
  const fillSelect = (sel, placeholder) => {
    sel.innerHTML = `<option value="">${placeholder}</option>` +
      players.map(p => `<option value="${escape(p.slug)}">${escape(p.name)} (${p.rating})</option>`).join('');
  };
  fillSelect(document.getElementById('matchWinner'), 'Kazanan seç...');
  fillSelect(document.getElementById('matchLoser'), 'Kaybeden seç...');
  document.getElementById('matchDate').value = todayISO();
}

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset() + 3 * 60);
  return d.toISOString().slice(0, 10);
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ───── Render switch ─────
function render() {
  renderPyramid();
  renderLeaderboard();
  renderMatches();
  renderInfo();
  renderAdmin();
}

// ───── Wiring ─────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-' + btn.dataset.view).classList.remove('hidden');
  });
});

document.getElementById('searchInput').addEventListener('input', renderLeaderboard);

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pwd = document.getElementById('adminPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');
  try {
    await login(pwd);
    renderAdmin();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearPwd();
  renderAdmin();
});

function readSets() {
  const sets = [];
  document.querySelectorAll('.set-row').forEach(row => {
    const w = row.querySelector('.set-w').value;
    const l = row.querySelector('.set-l').value;
    if (w !== '' || l !== '') sets.push([Number(w) || 0, Number(l) || 0]);
  });
  return sets;
}

function updatePreview() {
  const w = document.getElementById('matchWinner').value;
  const l = document.getElementById('matchLoser').value;
  const root = document.getElementById('matchPreview');
  if (!w || !l || w === l) { root.textContent = ''; return; }
  const p = previewDeltas(w, l);
  if (!p) { root.textContent = ''; return; }
  root.innerHTML = `${escape(p.winner.name)}: ${p.winner.before} → ${p.winner.after} (+${p.winner.delta})  ·  ` +
                   `${escape(p.loser.name)}: ${p.loser.before} → ${p.loser.after} (${p.loser.delta})`;
}
document.getElementById('matchWinner').addEventListener('change', updatePreview);
document.getElementById('matchLoser').addEventListener('change', updatePreview);

document.getElementById('matchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const winner = document.getElementById('matchWinner').value;
  const loser  = document.getElementById('matchLoser').value;
  if (!winner || !loser || winner === loser) {
    alert('Farklı iki oyuncu seç.');
    return;
  }
  const date = document.getElementById('matchDate').value || todayISO();
  const note = document.getElementById('matchNote').value;
  const sets = readSets();
  try {
    await submitMatch({ winner, loser, sets, note, date });
    document.getElementById('matchForm').reset();
    document.getElementById('matchPreview').textContent = '';
    await fetchState();
    alert('Maç kaydedildi.');
  } catch (err) {
    alert('Hata: ' + err.message);
  }
});

document.getElementById('undoBtn').addEventListener('click', async () => {
  if (!confirm('Son maçı geri al?')) return;
  try {
    await undoLastMatch();
    await fetchState();
    alert('Son maç geri alındı.');
  } catch (err) {
    alert('Hata: ' + err.message);
  }
});

document.getElementById('playerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('playerName').value.trim();
  const ratingRaw = document.getElementById('playerRating').value;
  const rating = ratingRaw ? Number(ratingRaw) : undefined;
  try {
    await addPlayer({ name, rating });
    document.getElementById('playerForm').reset();
    await fetchState();
    alert('Oyuncu eklendi.');
  } catch (err) {
    alert('Hata: ' + err.message);
  }
});

document.getElementById('seedBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('seedStatus');
  statusEl.textContent = 'Çalışıyor...';
  try {
    const r = await runSeed();
    statusEl.textContent = `Tamam: ${r.playerCount} oyuncu yüklendi.`;
    await fetchState();
  } catch (err) {
    statusEl.textContent = 'Hata: ' + err.message;
  }
});

// İlk yükleme
fetchState().catch(err => {
  console.error(err);
  document.getElementById('pyramid').innerHTML =
    `<p class="error">State alınamadı: ${escape(err.message)}</p>`;
});
