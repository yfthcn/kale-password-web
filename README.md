# 🔒 Kale — Güvenli Şifre Üreticisi

Tamamen tarayıcıda çalışan, sunucuya hiçbir şey göndermeyen güvenli şifre üreticisi.

**[→ Canlı Demo](https://yfthcn.github.io/kale-password-web/)**

---

## Özellikler

- 🔐 **Şifre** — uzunluk, karakter seti, tekrarsız mod, belirsiz karakter hariç tutma
- 💬 **İfade (Passphrase)** — Türkçe kelime listesiyle hatırlanması kolay ifadeler
- 🔢 **PIN** — sayısal veya alfanümerik, ardışık/tekrar yok seçenekleriyle
- 📊 Entropi bazlı güç göstergesi
- 📱 QR kod üretimi (sıfır bağımlılık, saf JS)
- 🎨 Animasyonlu arka plan
- ✅ Tamamen istemci tarafı — CDN yok, sunucu yok, veri transferi yok

---

## Dosya Yapısı

```
kale-password-web/
├── index.html      # Ana sayfa
├── style.css       # Tüm stiller
├── app.js          # Üretici mantığı + UI
├── qr.js           # Sıfır bağımlılıklı QR encoder
├── words.json      # Türkçe kelime listesi (~400 kelime)
├── .nojekyll       # GitHub Pages Jekyll devre dışı
└── README.md
```

---

## Lokal Çalıştırma

Proje saf HTML/CSS/JS olduğundan herhangi bir derleme adımı gerekmez.  
Ancak `words.json` dosyası `fetch()` ile yüklendiğinden, doğrudan `file://` ile açmak yerine bir HTTP sunucusu üzerinden çalıştırmanız önerilir.

```bash
git clone https://github.com/yfthcn/kale-password-web.git
cd kale-password-web

# Node.js varsa:
npx serve .

# Python varsa:
python3 -m http.server 8080
```

Tarayıcıda `http://localhost:8080` adresini açın.

---

## Güvenlik

- Tüm rastgelelik `crypto.getRandomValues()` (CSPRNG) ile üretilir
- Hiçbir şifre loglanmaz, saklanmaz veya dışarı iletilmez
- Harici bağımlılık yoktur (Google Fonts isteğe bağlı kaldırılabilir)

---

## Lisans

MIT © [yfthcn](https://github.com/yfthcn)
