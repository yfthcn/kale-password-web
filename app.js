'use strict';

// ── CSPRNG ────────────────────────────────────────────────────────────────────

function randInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let v;
  do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= limit);
  return v % max;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Charsets ──────────────────────────────────────────────────────────────────

const CS = {
  upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower:   'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{}|;:,.<>?/',
  ambig:   /[lIO01]/g,
};

function buildPool(opts) {
  let p = '';
  if (opts.upper)   p += CS.upper;
  if (opts.lower)   p += CS.lower;
  if (opts.numbers) p += CS.numbers;
  if (opts.symbols) p += CS.symbols;
  if (opts.noAmbig) p = p.replace(CS.ambig, '');
  if (opts.exclude) {
    const ex = new Set(opts.exclude);
    p = [...p].filter(c => !ex.has(c)).join('');
  }
  return [...new Set(p)].join('');
}

function charClass(c) {
  const code = c.charCodeAt(0);
  if (code >= 65 && code <= 90)  return 'upper';
  if (code >= 97 && code <= 122) return 'lower';
  if (code >= 48 && code <= 57)  return 'number';
  return 'symbol';
}

// ── Password generator ────────────────────────────────────────────────────────

function generatePassword(opts) {
  const pool = buildPool(opts);
  if (!pool.length) throw new Error('En az bir karakter seti seçin.');
  const len = opts.length;
  if (opts.noRepeat && pool.length < len)
    throw new Error(`Tekrarsız mod: havuz (${pool.length}) < uzunluk (${len})`);

  const required = [];
  const pick = src => {
    const chars = [...src].filter(c => pool.includes(c));
    if (chars.length) required.push(chars[randInt(chars.length)]);
  };
  if (opts.upper)   pick(CS.upper);
  if (opts.lower)   pick(CS.lower);
  if (opts.numbers) pick(CS.numbers);
  if (opts.symbols) pick(CS.symbols);

  const result = [...required];
  if (opts.noRepeat) {
    const used = new Set(result);
    const rest = shuffle([...pool].filter(c => !used.has(c)));
    result.push(...rest.slice(0, len - result.length));
  } else {
    while (result.length < len) result.push(pool[randInt(pool.length)]);
  }
  return shuffle(result).join('');
}

// ── Passphrase generator ──────────────────────────────────────────────────────

// ~400 yaygın Türkçe kelime
let WORDS = [];

function generatePassphrase(opts) {
  if (!WORDS.length) throw new Error('Kelime listesi yükleniyor, lütfen bekleyin.');
  const { count, sep, capitalize, addNumber } = opts;
  const chosen = [];
  const used   = new Set();

  while (chosen.length < count) {
    const w = WORDS[randInt(WORDS.length)];
    if (!used.has(w)) { used.add(w); chosen.push(w); }
  }

  const words = capitalize
    ? chosen.map(w => w.charAt(0).toUpperCase() + w.slice(1))
    : chosen;

  let phrase = words.join(sep);
  if (addNumber) phrase += sep + (randInt(90) + 10); // 10-99
  return phrase;
}

function passphraseEntropy(opts) {
  const wlen = WORDS.length || 1;
  let e = opts.count * Math.log2(wlen);
  if (opts.addNumber) e += Math.log2(90);
  return Math.round(e);
}

// ── PIN generator ─────────────────────────────────────────────────────────────

function generatePIN(opts) {
  const pool   = opts.alpha
    ? '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    : '0123456789';
  const digits = [...pool];
  if (opts.noRepeat && digits.length < opts.length)
    throw new Error('Tekrarsız PIN için yeterli karakter yok.');

  for (let attempt = 0; attempt < 2000; attempt++) {
    const pin = opts.noRepeat
      ? shuffle(digits).slice(0, opts.length).join('')
      : Array.from({ length: opts.length }, () => digits[randInt(digits.length)]).join('');
    if (opts.noSeq && hasSeq(pin)) continue;
    return pin;
  }
  throw new Error('PIN üretilemedi. Ayarları gevşetin.');
}

function hasSeq(pin) {
  for (let i = 0; i < pin.length - 2; i++) {
    const a = parseInt(pin[i], 36), b = parseInt(pin[i+1], 36), c = parseInt(pin[i+2], 36);
    if ((b === a+1 && c === b+1) || (b === a-1 && c === b-1)) return true;
  }
  return false;
}

// ── Strength ──────────────────────────────────────────────────────────────────

function calcEntropy(pw, opts) {
  const pool = buildPool(opts);
  if (!pool.length) return 0;
  return pw.length * Math.log2(opts.noRepeat ? Math.min(pool.length, pw.length) : pool.length);
}

function calcStrength(pw, opts) {
  if (!pw) return { score: 0, label: '—', entropy: 0 };
  const e     = calcEntropy(pw, opts);
  const types = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(pw)).length;
  let s = 0;
  if (e >= 28)  s = 1;
  if (e >= 40)  s = 2;
  if (e >= 60)  s = 3;
  if (e >= 80)  s = 4;
  if (e >= 100) s = 5;
  if (/(.)\1{2,}/.test(pw)) s = Math.max(1, s - 1);
  if (types >= 4 && s < 5)  s = Math.min(5, s + 1);
  const labels = ['—', 'Zayıf', 'Orta', 'İyi', 'Güçlü', 'Çok Güçlü'];
  return { score: s, label: labels[s], entropy: Math.round(e) };
}

function scoreToStrength(e) {
  let s = 0;
  if (e >= 28)  s = 1;
  if (e >= 40)  s = 2;
  if (e >= 60)  s = 3;
  if (e >= 80)  s = 4;
  if (e >= 100) s = 5;
  const labels = ['—','Zayıf','Orta','İyi','Güçlü','Çok Güçlü'];
  return { score: s, label: labels[s], entropy: Math.round(e) };
}

function calcPINStrength(pin, opts) {
  const pool = opts.alpha ? 36 : 10;
  const e    = pin.length * Math.log2(pool);
  let s = 0;
  if (e >= 10) s = 1; if (e >= 13) s = 2; if (e >= 20) s = 3;
  if (e >= 26) s = 4; if (e >= 33) s = 5;
  const labels = ['—', 'Zayıf', 'Orta', 'İyi', 'Güçlü', 'Çok Güçlü'];
  return { score: s, label: labels[s], entropy: Math.round(e) };
}

// ── QR Code (qr.js — sıfır CDN, sıfır bağımlılık) ────────────────────────────

function drawQR(text, canvasEl) {
  try {
    KaleQR.render(text, canvasEl, {
      dark:  '#00d4aa',
      light: '#0d1017',
      pad:   4,
    });
  } catch(e) {
    console.error('QR render hatası:', e);
  }
}

// ── Background canvas ─────────────────────────────────────────────────────────

function initCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const CHARS  = '01アイウエABCDEF!@#$%';
  const COUNT  = 80;
  const particles = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x:     Math.random() * window.innerWidth,
      y:     Math.random() * window.innerHeight,
      speed: 0.15 + Math.random() * 0.3,
      char:  CHARS[Math.floor(Math.random() * CHARS.length)],
      alpha: 0.08 + Math.random() * 0.12,
      size:  12 + Math.random() * 11,
      timer: Math.random() * 120,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Parçacıkları boyuta göre grupla — font değişimini minimize et
    particles.sort((a,b) => a.size - b.size);
    let lastSize = -1;
    particles.forEach(p => {
      p.y -= p.speed;
      if (--p.timer <= 0) {
        p.char  = CHARS[Math.floor(Math.random() * CHARS.length)];
        p.timer = 60 + Math.random() * 120;
      }
      if (p.y < -20) { p.y = canvas.height + 20; p.x = Math.random() * canvas.width; }
      if (p.size !== lastSize) {
        ctx.font = `${p.size}px 'IBM Plex Mono', monospace`;
        lastSize = p.size;
      }
      ctx.fillStyle = `rgba(0,212,170,${p.alpha})`;
      ctx.fillText(p.char, p.x, p.y);
    });
    requestAnimationFrame(draw);
  }
  draw();
}

// ── Slider helpers ────────────────────────────────────────────────────────────

function updateFill(slider, fill) {
  const pct = (slider.value - slider.min) / (slider.max - slider.min);
  fill.style.width = `calc(${pct * 100}% + ${10 - pct * 20}px)`;
}

function renderTicks(containerId, values, min, max) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = '';
  values.forEach(v => {
    const pct  = (v - min) / (max - min);
    const span = document.createElement('span');
    span.className   = 'tick-mark';
    span.style.left  = `calc(${pct * 100}% + ${10 - pct * 20}px)`;
    span.textContent = v;
    wrap.appendChild(span);
  });
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

// ── Cached DOM refs ───────────────────────────────────────────────────────────
// Sık kullanılan elementleri bir kez çek, her generate'de querySelector maliyetini önle
let _DOM = {};
function initDOM() {
  ['output-placeholder','output-chars','output-label','color-legend',
   'btn-qr','strength-segments','strength-label','strength-entropy',
   'toast','qr-overlay','qr-canvas'].forEach(id => { _DOM[id] = document.getElementById(id); });
}
const $c = id => _DOM[id] || document.getElementById(id);


function showToast(msg = 'Kopyalandı') {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement('textarea'),
      { value: text, style: 'position:fixed;opacity:0' });
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  if (btn) { btn.classList.add('copied'); setTimeout(() => btn.classList.remove('copied'), 1500); }
  showToast();
}

// ── Output rendering ──────────────────────────────────────────────────────────

function renderOutput(text, colored) {
  const ph    = $('output-placeholder');
  const chars = $('output-chars');
  if (!text) { ph.style.display = ''; chars.style.display = 'none'; return; }
  ph.style.display    = 'none';
  chars.style.display = '';

  if (colored) {
    chars.style.fontSize      = '';
    chars.style.letterSpacing = '0.04em';
    chars.innerHTML = [...text].map(c =>
      `<span class="ch-${charClass(c)}">${esc(c)}</span>`
    ).join('');
  } else {
    // passphrase or PIN — plain accent color
    chars.style.fontSize      = mode === 'pin' ? 'clamp(1.4rem,5vw,2rem)' : 'clamp(0.85rem,3vw,1.05rem)';
    chars.style.letterSpacing = mode === 'pin' ? '0.28em' : '0.02em';
    chars.style.color         = 'var(--accent)';
    chars.innerHTML = esc(text);
  }
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function animateOutput(final, colored) {
  const POOL  = '!@#ABCDabcd0123';
  let frame   = 0;
  const MAX   = 10;
  const chars = $('output-chars');
  $('output-placeholder').style.display = 'none';
  chars.style.display = '';
  chars.style.color   = '';

  const iv = setInterval(() => {
    frame++;
    const s = [...final].map((c, i) =>
      frame > MAX - (final.length - i) / final.length * MAX
        ? c : POOL[Math.floor(Math.random() * POOL.length)]
    ).join('');
    renderOutput(s, colored);
    if (frame >= MAX) { clearInterval(iv); renderOutput(final, colored); }
  }, 28);
}

// ── Strength UI ───────────────────────────────────────────────────────────────

function applyStrength(str) {
  $('strength-segments').className  = `strength-segments str-${str.score}`;
  $('strength-label').textContent   = str.label;
  $('strength-entropy').textContent = str.entropy ? `${str.entropy} bit` : '';
}

function resetStrength() {
  $('strength-segments').className  = 'strength-segments';
  $('strength-label').textContent   = '—';
  $('strength-entropy').textContent = '';
}

// ── State ─────────────────────────────────────────────────────────────────────

let mode      = 'password';
let lastValue = '';

// ── Options ───────────────────────────────────────────────────────────────────

function getPwOpts() {
  return {
    length:   parseInt($('password-length').value),
    upper:    $('use-upper').checked,
    lower:    $('use-lower').checked,
    numbers:  $('use-numbers').checked,
    symbols:  $('use-symbols').checked,
    noAmbig:  $('exclude-ambiguous').checked,
    noRepeat: $('no-repeat').checked,
    exclude:  $('custom-exclude').value,
  };
}

function getPpOpts() {
  return {
    count:      parseInt($('pp-words').value),
    sep:        document.querySelector('input[name="pp-sep"]:checked').value,
    capitalize: $('pp-capitalize').checked,
    addNumber:  $('pp-number').checked,
  };
}

function getPinOpts() {
  return {
    length:   parseInt($('pin-length').value),
    noSeq:    $('pin-no-seq').checked,
    noRepeat: $('pin-no-repeat').checked,
    alpha:    document.querySelector('input[name="pin-type"]:checked').value === 'alpha',
  };
}

// ── Generate ──────────────────────────────────────────────────────────────────

function generate() {
  try {
    if (mode === 'password') {
      const opts = getPwOpts();
      const pw   = generatePassword(opts);
      lastValue  = pw;
      animateOutput(pw, true);
      applyStrength(calcStrength(pw, opts));
      $('output-label').textContent   = 'ŞİFRE';
      $('color-legend').style.display = 'flex';
      $('btn-qr').style.display       = 'flex';

    } else if (mode === 'passphrase') {
      const opts   = getPpOpts();
      const phrase = generatePassphrase(opts);
      lastValue    = phrase;
      animateOutput(phrase, false);
      const e = passphraseEntropy(opts);
      applyStrength(scoreToStrength(e));
      $('output-label').textContent   = 'İFADE';
      $('color-legend').style.display = 'none';
      $('btn-qr').style.display       = 'flex';

    } else {
      const opts = getPinOpts();
      const pin  = generatePIN(opts);
      lastValue  = pin;
      animateOutput(pin, false);
      applyStrength(calcPINStrength(pin, opts));
      $('output-label').textContent   = 'PIN';
      $('color-legend').style.display = 'none';
      $('btn-qr').style.display       = 'flex';
    }
  } catch (e) {
    const ph = $('output-placeholder');
    ph.style.display = '';
    ph.textContent   = '⚠ ' + e.message;
    $('output-chars').style.display = 'none';
    $('btn-qr').style.display       = 'none';
    lastValue = '';
  }
}


// ── Slider max kısıtlama (tekrar etme modu) ───────────────────────────────────

function clampPasswordSlider() {
  const slider  = $('password-length');
  const noRep   = $('no-repeat').checked;
  const pool    = buildPool(getPwOpts());
  const maxVal  = noRep ? Math.min(pool.length, 128) : 128;

  slider.max = maxVal;

  // Mevcut değer sınırı aşıyorsa geri çek
  if (parseInt(slider.value) > maxVal) {
    slider.value = maxVal;
    $('pw-len-val').textContent = maxVal;
    updateFill(slider, $('pw-track-fill'));
  }

  // Tick'leri güncelle — sınır değişince son tick de değişir
  const ticks = maxVal < 64 ? [4, 16, 32, maxVal] : [4, 16, 32, 64, 128];
  renderTicks('pw-ticks', ticks, 4, 128);

  // Aralık ipucunu güncelle
  const hint = document.querySelector('#panel-password .slider-range-hint');
  if (hint) hint.textContent = noRep ? `4 — ${maxVal}` : '4 — 128';
}

// ── Events ────────────────────────────────────────────────────────────────────

$('btn-refresh').addEventListener('click', generate);

$('btn-copy').addEventListener('click', () => {
  if (lastValue) copyText(lastValue, $('btn-copy'));
});

$('btn-qr').addEventListener('click', () => {
  if (!lastValue) return;
  $('qr-overlay').style.display = 'flex';
  drawQR(lastValue, $('qr-canvas'));
});

$('qr-close').addEventListener('click', () => {
  $('qr-overlay').style.display = 'none';
});

$('qr-overlay').addEventListener('click', e => {
  if (e.target === $('qr-overlay')) $('qr-overlay').style.display = 'none';
});

// Mode switch
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    if (this.dataset.mode === mode) return;
    mode = this.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    ['password','passphrase','pin'].forEach(m => {
      $(`panel-${m}`).classList.toggle('active', m === mode);
    });
    $('output-placeholder').style.display = '';
    $('output-placeholder').textContent   = 'üretiliyor_';
    $('output-chars').style.display       = 'none';
    $('color-legend').style.display       = 'none';
    $('btn-qr').style.display             = 'none';
    lastValue = '';
    resetStrength();
    generate();
  });
});

function onOpt() { generate(); }

['use-upper','use-lower','use-numbers','use-symbols','exclude-ambiguous'].forEach(id => {
  $(id).addEventListener('change', () => { clampPasswordSlider(); onOpt(); });
});
$('no-repeat').addEventListener('change', () => { clampPasswordSlider(); onOpt(); });
$('custom-exclude').addEventListener('input', onOpt);
['pin-no-seq','pin-no-repeat'].forEach(id => $(id).addEventListener('change', onOpt));
['pp-capitalize','pp-number'].forEach(id => $(id).addEventListener('change', onOpt));
document.querySelectorAll('input[name="pin-type"]').forEach(r => r.addEventListener('change', onOpt));
document.querySelectorAll('input[name="pp-sep"]').forEach(r => r.addEventListener('change', onOpt));

$('password-length').addEventListener('input', function () {
  $('pw-len-val').textContent = this.value;
  updateFill(this, $('pw-track-fill'));
  generate();
});

$('pin-length').addEventListener('input', function () {
  $('pin-len-val').textContent = this.value;
  updateFill(this, $('pin-track-fill'));
  generate();
});

$('pp-words').addEventListener('input', function () {
  $('pp-word-val').textContent = this.value;
  updateFill(this, $('pp-track-fill'));
  generate();
});

// ── Init ──────────────────────────────────────────────────────────────────────

initDOM();
initCanvas();

renderTicks('pw-ticks',  [4, 16, 32, 64, 128], 4, 128);
renderTicks('pin-ticks', [4, 6, 8, 10, 12],    4, 12);
renderTicks('pp-ticks',  [3, 4, 5, 6, 7, 8],   3, 8);

updateFill($('password-length'), $('pw-track-fill'));
clampPasswordSlider();
updateFill($('pin-length'),      $('pin-track-fill'));
updateFill($('pp-words'),        $('pp-track-fill'));

// Kelime listesini yükle, sonra üret
fetch('words.json')
  .then(r => r.json())
  .then(list => {
    WORDS = list;
    generate();
  })
  .catch(() => {
    // Yedek: fetch başarısız olursa (file:// protokolü vb.) küçük yerleşik liste
    WORDS = ['kale','dağ','deniz','rüzgar','güneş','ay','yıldız','orman',
             'toprak','bulut','ateş','su','taş','kar','çam','lale',
             'kartal','aslan','geyik','balık','arı','kelebek','bülbül','kuş',
             'bahar','yaz','sonbahar','kış','sabah','gece','akşam','şimşek'];
    generate();
  });
