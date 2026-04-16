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

## Güvenlik

- Tüm rastgelelik `crypto.getRandomValues()` (CSPRNG) ile üretilir
- Hiçbir şifre loglanmaz, saklanmaz veya dışarı iletilmez
- Harici bağımlılık yoktur — her şey tarayıcıda çalışır

---

## Lisans

MIT © [yfthcn](https://github.com/yfthcn)
