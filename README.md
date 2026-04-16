# 🔒 Kale — Güvenli Şifre Üreticisi

Tamamen tarayıcıda çalışan, sunucuya hiçbir şey göndermeyen güvenli şifre üreticisi.

**[→ Canlı Demo](https://yfthcn.github.io/kale-password-web/)**

## Özellikler

- 🔐 **Şifre** — uzunluk, karakter seti, tekrarsız mod, belirsiz karakter hariç tutma
- 💬 **İfade (Passphrase)** — Türkçe kelime listesiyle hatırlanması kolay ifadeler
- 🔢 **PIN** — sayısal veya alfanümerik, ardışık/tekrar yok seçenekleriyle
- 📊 Entropi bazlı güç göstergesi
- 📱 QR kod üretimi (sıfır bağımlılık, saf JS)
- 🎨 Animasyonlu arka plan
- ✅ Tamamen istemci tarafı — CDN yok, sunucu yok, veri transferi yok

## Kurulum & Çalıştırma

### Lokal

```bash
git clone https://github.com/kullaniciadiniz/kale.git
cd kale
# Herhangi bir statik sunucu:
npx serve .
# veya
python3 -m http.server 8080
```

> ⚠️ `words.json` için `fetch()` kullandığından doğrudan `file://` ile açmak passphrase modunda fallback listeye düşer. Bir HTTP sunucusu üzerinden açmanız önerilir.

### GitHub Pages

1. Repoyu fork'la veya push'la
2. **Settings → Pages → Branch: `main` / `(root)`** seç
3. Kaydet — birkaç dakika içinde `https://kullaniciadiniz.github.io/kale` adresinde yayınlanır

## Dosya Yapısı

```
kale/
├── index.html      # Ana sayfa
├── style.css       # Tüm stiller
├── app.js          # Üretici mantığı + UI
├── qr.js           # Sıfır bağımlılıklı QR encoder
└── words.json      # Türkçe kelime listesi (~400 kelime)
```

## Güvenlik

- `crypto.getRandomValues()` kullanır (CSPRNG)
- Hiçbir şifre loglanmaz, saklanmaz veya iletilmez
- Dış kaynak yok (Google Fonts hariç, isteğe bağlı kaldırılabilir)

## Lisans

MIT
