/**
 * qr.js — Minimal QR Code encoder (saf JS, sıfır bağımlılık)
 * Byte mode, ECC Level M, Version 1-10 desteği
 * Kale projesi için yazılmıştır.
 */
(function(global) {
'use strict';

// ── Sabitler ──────────────────────────────────────────────────────────────────

// Reed-Solomon hata düzeltme tablosu [versiyon][ECC_M] → {ecPerBlock, g1:{blocks,dcPerBlock}, g2?}
const RS_TABLE = {
  1:  { ec:10, g1:{n:1, dc:16} },
  2:  { ec:16, g1:{n:1, dc:28} },
  3:  { ec:26, g1:{n:1, dc:44} },
  4:  { ec:18, g1:{n:2, dc:32} },
  5:  { ec:24, g1:{n:2, dc:43} },
  6:  { ec:16, g1:{n:4, dc:27} },
  7:  { ec:18, g1:{n:4, dc:31} },
  8:  { ec:22, g1:{n:2, dc:38}, g2:{n:2, dc:39} },
  9:  { ec:22, g1:{n:3, dc:36}, g2:{n:2, dc:37} },
  10: { ec:26, g1:{n:4, dc:43}, g2:{n:1, dc:44} },
};

// Karakter kapasiteleri (byte modu, ECC M)
const CAPACITY = [0,14,26,42,62,84,106,122,154,180,205];

// GF(256) tablolar
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function(){
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

const _polyCache = {};
function gfPoly(degree) {
  if (_polyCache[degree]) return _polyCache[degree];
  let p = [1];
  for (let i = 0; i < degree; i++) {
    const g = [1, GF_EXP[i]];
    const res = new Uint8Array(p.length + 1);
    for (let j = 0; j < p.length; j++)
      for (let k = 0; k < g.length; k++)
        res[j + k] ^= gfMul(p[j], g[k]);
    p = Array.from(res);
  }
  return (_polyCache[degree] = p);
}

function reedSolomon(data, ecCount) {
  const gen = gfPoly(ecCount);
  const msg = [...data, ...new Array(ecCount).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const c = msg[i];
    if (c !== 0)
      for (let j = 0; j < gen.length; j++)
        msg[i + j] ^= gfMul(gen[j], c);
  }
  return msg.slice(data.length);
}

// ── Format & Maskeleme ────────────────────────────────────────────────────────

// Format bilgisi (ECC M, mask 0): önceden hesaplanmış
const FORMAT_BITS = {
  0: 0b101010000010010,
  1: 0b101000100100101,
  2: 0b101111001111100,
  3: 0b101101101001011,
  4: 0b100010111111001,
  5: 0b100000011001110,
  6: 0b100111110010111,
  7: 0b100101010100000,
};

function applyMask(matrix, mask) {
  const size = matrix.length;
  const m = matrix.map(r => [...r]);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (m[r][c] === null) continue;
      let invert = false;
      switch(mask) {
        case 0: invert = (r + c) % 2 === 0; break;
        case 1: invert = r % 2 === 0; break;
        case 2: invert = c % 3 === 0; break;
        case 3: invert = (r + c) % 3 === 0; break;
        case 4: invert = (Math.floor(r/2) + Math.floor(c/3)) % 2 === 0; break;
        case 5: invert = ((r*c)%2 + (r*c)%3) === 0; break;
        case 6: invert = ((r*c)%2 + (r*c)%3) % 2 === 0; break;
        case 7: invert = ((r+c)%2 + (r*c)%3) % 2 === 0; break;
      }
      if (invert) m[r][c] = m[r][c] ^ 1;
    }
  }
  return m;
}

function penalty(matrix) {
  const size = matrix.length;
  let p = 0;
  // Rule 1: 5+ consecutive same-color
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c-1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
      else run = 1;
    }
    run = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[c][r] === matrix[c-1][r]) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
      else run = 1;
    }
  }
  return p;
}

// ── Matrix builder ────────────────────────────────────────────────────────────

function buildMatrix(version, data) {
  const size = version * 4 + 17;
  const m = Array.from({length: size}, () => new Array(size).fill(null));

  // Finder patterns
  function finder(r, c) {
    for (let i = -1; i <= 7; i++)
      for (let j = -1; j <= 7; j++) {
        if (r+i < 0 || r+i >= size || c+j < 0 || c+j >= size) continue;
        const inside = i >= 0 && i <= 6 && j >= 0 && j <= 6;
        const border = i === 0 || i === 6 || j === 0 || j === 6;
        const inner  = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        m[r+i][c+j] = (border || inner) ? 1 : 0;
      }
  }
  finder(0, 0); finder(0, size-7); finder(size-7, 0);

  // Separators (already 0 from finder border)

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    m[6][i] = m[i][6] = i % 2 === 0 ? 1 : 0;
  }

  // Dark module
  m[size-8][8] = 1;

  // Alignment patterns (version >= 2)
  const ALIGN_POS = [
    [],[], [6,18],[6,22],[6,26],[6,30],[6,34],
    [6,22,38],[6,24,42],[6,28,46],[6,26,46,66]
  ];
  if (version >= 2) {
    const pos = ALIGN_POS[version];
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const r = pos[i], c = pos[j];
        if (m[r][c] !== null) continue;
        for (let dr = -2; dr <= 2; dr++)
          for (let dc = -2; dc <= 2; dc++) {
            const border = Math.abs(dr) === 2 || Math.abs(dc) === 2;
            const center = dr === 0 && dc === 0;
            m[r+dr][c+dc] = (border || center) ? 1 : 0;
          }
      }
    }
  }

  // Format info placeholder (we'll fill after mask)
  FP.forEach(([r,c]) => { m[r][c] = 0; });
  // Mirror
  for (let i = 0; i < 8; i++) m[size-1-i][8] = 0;
  for (let i = 0; i < 8; i++) m[8][size-8+i] = 0;

  return m;
}

function placeData(matrix, bits) {
  const size = matrix.length;
  let idx = 0;
  let up = true;

  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5;
    for (let row = 0; row < size; row++) {
      const r = up ? size - 1 - row : row;
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (matrix[r][cc] !== null) continue;
        matrix[r][cc] = idx < bits.length ? bits[idx++] : 0;
      }
    }
    up = !up;
  }
}

const FP = [
  [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],
  [7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]
];

function fillFormat(matrix, mask) {
  const size = matrix.length;
  const fmt = FORMAT_BITS[mask];
  for (let i = 0; i < 15; i++) {
    const bit = (fmt >> (14 - i)) & 1;
    const [r,c] = FP[i];
    matrix[r][c] = bit;
    if (i < 8) matrix[size-1-i][8] = bit;
    else        matrix[8][size-7+(i-7)] = bit;
  }
}

// ── Encoding ──────────────────────────────────────────────────────────────────

function encode(text) {
  const bytes = new TextEncoder().encode(text);
  const len   = bytes.length;

  // Find version
  let version = 1;
  while (version <= 10 && CAPACITY[version] < len) version++;
  if (version > 10) throw new Error('Metin QR için çok uzun');

  const rs      = RS_TABLE[version];
  const totalDC = (rs.g1.n * rs.g1.dc) + (rs.g2 ? rs.g2.n * rs.g2.dc : 0);

  // Build bit stream
  const bits = [];
  const push = (val, n) => { for (let i = n-1; i >= 0; i--) bits.push((val >> i) & 1); };

  push(0b0100, 4);        // byte mode
  push(len, 8);           // char count
  bytes.forEach(b => push(b, 8));

  // Terminator
  for (let i = 0; i < 4 && bits.length < totalDC * 8; i++) bits.push(0);

  // Byte-align
  while (bits.length % 8) bits.push(0);

  // Pad bytes
  const PAD = [0b11101100, 0b00010001];
  let pi = 0;
  while (bits.length < totalDC * 8) {
    push(PAD[pi++ % 2], 8);
  }

  // Build data codewords
  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i+j];
    dataBytes.push(b);
  }

  // Split into blocks
  const blocks = [];
  let offset = 0;
  for (let b = 0; b < rs.g1.n; b++) {
    blocks.push(dataBytes.slice(offset, offset + rs.g1.dc));
    offset += rs.g1.dc;
  }
  if (rs.g2) {
    for (let b = 0; b < rs.g2.n; b++) {
      blocks.push(dataBytes.slice(offset, offset + rs.g2.dc));
      offset += rs.g2.dc;
    }
  }

  // EC for each block
  const ecBlocks = blocks.map(b => reedSolomon(b, rs.ec));

  // Interleave data
  const final = [];
  const maxDC = Math.max(...blocks.map(b => b.length));
  for (let i = 0; i < maxDC; i++)
    blocks.forEach(b => { if (i < b.length) final.push(b[i]); });

  // Interleave EC
  for (let i = 0; i < rs.ec; i++)
    ecBlocks.forEach(b => final.push(b[i]));

  // To bits
  const finalBits = [];
  final.forEach(byte => {
    for (let i = 7; i >= 0; i--) finalBits.push((byte >> i) & 1);
  });

  // Build matrix
  const matrix = buildMatrix(version, finalBits);
  placeData(matrix, finalBits);

  // Find best mask
  let bestMask = 0, bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const masked = applyMask(matrix.map(r => [...r]), mask);
    fillFormat(masked, mask);
    const p = penalty(masked);
    if (p < bestPenalty) { bestPenalty = p; bestMask = mask; }
  }

  const final_m = applyMask(matrix, bestMask);
  fillFormat(final_m, bestMask);
  return final_m;
}

// ── Canvas renderer ───────────────────────────────────────────────────────────

function render(text, canvas, opts) {
  opts = opts || {};
  const dark  = opts.dark  || '#00d4aa';
  const light = opts.light || '#0d1017';
  const pad   = opts.pad   || 4;

  let matrix;
  try { matrix = encode(text); }
  catch(e) { console.error('QR:', e); return; }

  const size    = matrix.length;
  const cellPx  = opts.cell || Math.floor((220 - pad * 2 * 8) / size);
  const totalPx = size * cellPx + pad * 2 * cellPx;

  canvas.width  = totalPx;
  canvas.height = totalPx;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, totalPx, totalPx);

  ctx.fillStyle = dark;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        ctx.fillRect(
          (c + pad) * cellPx,
          (r + pad) * cellPx,
          cellPx, cellPx
        );
      }
    }
  }
}

global.KaleQR = { render };

})(window);
