# Notlar

## Tenis Ligi (ELO) — yeni modül (2026-05-13)

### Yapı
- `league/` → frontend (HTML/CSS/JS) — URL: `/league/`
- `functions/api/league/` → backend endpoints
- KV: aynı `TENNIS_DATA` namespace, key: `league:state`
- Auth: tek admin şifresi, env var `LEAGUE_ADMIN_PASSWORD`

### Endpointler
- `GET    /api/league/state` — herkes okuyabilir
- `POST   /api/league/login` — şifre doğrula
- `POST   /api/league/match` — admin: yeni maç
- `DELETE /api/league/match` — admin: son maçı geri al
- `POST   /api/league/player` — admin: oyuncu ekle/güncelle
- `DELETE /api/league/player` — admin: oyuncu sil (body: {slug})

### İlk seed (yapıldı, 2026-05-13)
50 oyuncu KV'ye doğrudan yazıldı (`league/seed.json` referansından üretildi):
```bash
npx wrangler kv key put --namespace-id=d162e702f4fd449594f75d29bfad41bb "league:state" --path=/tmp/league-state.json --remote
```
`league/seed.json` tarihsel referans olarak duruyor; admin UI'da seed butonu yok.

### Deploy (Pages git'e bağlı DEĞİL, manuel)
```bash
npx wrangler pages deploy . --project-name=tenis-program --branch=main
```
İlk kez şifre kurulumu:
```bash
echo "şifre" | npx wrangler pages secret put LEAGUE_ADMIN_PASSWORD --project-name=tenis-program
```

### ELO config
- K-factor: 32 (standart maç sonrası değişim)
- Provisional K: 64, ilk 5 maç için
- Initial rating (yeni oyuncu): 1200
- Ölçekleme: `rating = round(1000 + (eski_puan / 910) * 800)` → 1000-1800 aralığı

### KV state şeması
```json
{
  "config": { "kFactor": 32, "provisionalK": 64, "provisionalMatches": 5, "initialRating": 1200, "milat": "2026-05-13" },
  "players": { "alper": { "name": "Alper", "rating": 1800, "wins": 0, "losses": 0, "matchesPlayed": 0, "active": true, "lastMatch": null } },
  "matches": [ { "id": "m_0001", "date": "2026-05-13", "winner": "alper", "loser": "nuri", "sets": [[6,3],[6,2]], "delta": {...}, "ratingBefore": {...}, "ratingAfter": {...} } ]
}
```


## DNS / Subdomain talebi (geçmiş)

`tennis-reservation.is-a.dev` subdomain talebi: https://github.com/is-a-dev/register/pull/37504

- 2026-05-03 tarihinde @iturna tarafından açıldı (is-a-dev/register repo'suna PR)
- is-a.dev → ücretsiz `.is-a.dev` subdomain servisi
- Status kontrolü: `gh pr view 37504 --repo is-a-dev/register --json state,statusCheckRollup,reviewDecision,labels,mergedAt`
- Hızlandırma için Discord: https://discord.gg/is-a-dev-830872854677422150 → `#pull-requests` kanalına PR numarası **sadece bir kez** yazılır (fazlası "low priority" işareti getirir)
- **2026-05-08:** PR #37504 reddedildi (`status: denied`, `reason: not dev related`). is-a.dev root subdomain'leri yazılım geliştirmeyle ilgili olmak zorunda; tenis rezervasyon aracı uymuyor.

## eu.org başvurusu (aktif)

### Künye
- **Hedef domain:** `tennis-reservation.eu.org`
- **Başvuru sitesi:** https://nic.eu.org/
- **Başvuru tarihi:** 2026-05-12
- **eu.org contact handle:** `IT431-FREE` (kayıt e-postası: ismaturna@hotmail.com)
- **eu.org request ID:** `20260512112850-arf-2944`
- **Durum:** `pending review` (teknik kontroller geçti, manuel onay bekleniyor)
- **Cloudflare nameservers:** `lennox.ns.cloudflare.com`, `lucy.ns.cloudflare.com`
- **Cloudflare zone:** `tennis-reservation.eu.org` ("Waiting for nameservers" durumunda)

### Tamamlanan adımlar
1. ✅ Cloudflare'e `tennis-reservation.eu.org` zone'u eklendi (Free plan), NS değerleri alındı.
2. ✅ eu.org hesabı açıldı, contact handle `IT431-FREE` oluşturuldu.
3. ✅ Domain talebi gönderildi (Private WHOIS işaretli, 2 Cloudflare NS girildi, SOA/NS kontrolleri yeşil).

## Bundan sonra yapılacaklar

### Onay beklerken paralel olarak yapılabilecekler
1. ✅ **Cloudflare DNS kayıtları eklendi** (2026-05-12):
   - `CNAME @ → tenis-program.pages.dev` (Proxied)
   - `CNAME www → tenis-program.pages.dev` (Proxied)
2. ⛔ **Pages custom domain eklenemiyor (şu an):**
   - Cloudflare zone "Invalid nameservers" durumunda olduğu için Pages "Set up a custom domain" akışı engelliyor.
   - Bu adım eu.org onayı + NS propagasyonu tamamlandıktan sonra yapılabilir.
3. **SSL/TLS modu (yapılabilir):**
   - Zone → SSL/TLS → Overview → "Full" veya "Full (strict)" seç. Pages otomatik sertifika sağlar.

### eu.org onayı geldiğinde (otomatik mail)
1. **Cloudflare'i kontrol et:** zone "Active" durumuna geçmeli (NS propagasyonu eu.org tarafında tamamlanınca).
   - Kontrol: `dig NS tennis-reservation.eu.org +short` → `lennox.ns.cloudflare.com`, `lucy.ns.cloudflare.com` dönmeli.
2. **Pages custom domain'i doğrula:** Workers & Pages → tenis-program → Custom domains → durum "Active" olmalı, SSL sertifikası issued.
3. **Live test:**
   - https://tennis-reservation.eu.org → tenis-program UI yüklenmeli.
   - https://tennis-reservation.eu.org/api/... → Pages Functions endpoint'leri çalışmalı.
4. **Eski URL yönlendirmesi:** `tenis-program.pages.dev` zaten yönlendirme ile çalışıyor (commit a416614). Onaylanan custom domain'e de gerekirse yönlendirme ekle.
5. **README / index.html güncelle:** Varsa eski domain referanslarını yeni domain ile değiştir.

### Reddedilirse / ek bilgi istenirse
- E-postadaki gerekçeye göre justification'ı revize et veya domain ismini değiştir (`tennis-grubu.eu.org` vb.).
- Yeniden başvuru: aynı hesaptan yeni "New domain" talebi açılabilir.

### Durum takibi
- **eu.org panel:** https://nic.eu.org/ → login → My domains → request status.
- **Sorun/destek:** https://nic.eu.org/contact.html
- **Cloudflare zone:** dashboard → Domains → Overview → `tennis-reservation.eu.org`.

## Yedek planlar (eu.org reddedilirse veya çok uzarsa)
- **Nested is-a.dev:** önce `iturna.is-a.dev` gibi yazılım odaklı root subdomain al, altına `tennis.iturna.is-a.dev` koy (nested'da içerik kuralı yok).
- **Ucuz domain:** Cloudflare Registrar üzerinden `.xyz` (~$2/yıl), `.dev` (~$10/yıl), `.online` vb. — anında, kural yok.
