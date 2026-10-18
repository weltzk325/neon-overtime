/* ============================================================
   util.js — math, rng, canvas helpers
   ============================================================ */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = (G.U = {});

  U.TAU = Math.PI * 2;
  U.W = 960;
  U.H = 540;

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  U.chance = (p) => Math.random() < p;
  U.sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  U.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  U.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  U.dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };
  U.angle = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  U.angleLerp = (a, b, t) => {
    let d = ((b - a + Math.PI) % U.TAU) - Math.PI;
    if (d < -Math.PI) d += U.TAU;
    return a + d * t;
  };
  U.approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
  U.formatTime = (s) => {
    s = Math.max(0, Math.floor(s));
    return String((s / 60) | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  U.fmt = (n) => {
    n = Math.floor(n);
    return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n);
  };
  U.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  U.easeOutBack = (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };
  U.easeOutElastic = (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (U.TAU / 3)) + 1;
  };

  // deterministic rng
  U.rng = (seed) => {
    let s = seed >>> 0 || 1;
    return function () {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hashSeed = (s) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  U.weightedPick = (list, weightFn) => {
    let total = 0;
    const ws = list.map((it) => {
      const w = Math.max(0, weightFn(it));
      total += w;
      return w;
    });
    if (total <= 0) return list[0];
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
      r -= ws[i];
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  };

  // ---------- collision ----------
  U.circleRect = (cx, cy, r, rc) => {
    const nx = U.clamp(cx, rc.x, rc.x + rc.w);
    const ny = U.clamp(cy, rc.y, rc.y + rc.h);
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy <= r * r;
  };
  U.pointRect = (x, y, rc) => x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h;
  U.rectsOverlap = (a, b, pad = 0) =>
    a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;

  // push a circle out of a rectangle; returns corrected position
  U.resolveCircleRect = (cx, cy, r, rc) => {
    const nx = U.clamp(cx, rc.x, rc.x + rc.w);
    const ny = U.clamp(cy, rc.y, rc.y + rc.h);
    let dx = cx - nx, dy = cy - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) return null;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      return { x: nx + (dx / d) * r, y: ny + (dy / d) * r, nx: dx / d, ny: dy / d };
    }
    // center inside rect: push out along smallest axis
    const left = cx - rc.x, right = rc.x + rc.w - cx;
    const top = cy - rc.y, bottom = rc.y + rc.h - cy;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: rc.x - r, y: cy, nx: -1, ny: 0 };
    if (m === right) return { x: rc.x + rc.w + r, y: cy, nx: 1, ny: 0 };
    if (m === top) return { x: cx, y: rc.y - r, nx: 0, ny: -1 };
    return { x: cx, y: rc.y + rc.h + r, nx: 0, ny: 1 };
  };

  // segment-circle intersection test (squared distance from center to segment)
  U.segCircle = (x1, y1, x2, y2, cx, cy, r) => {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / l2 : 0;
    t = U.clamp(t, 0, 1);
    const px = x1 + dx * t, py = y1 + dy * t;
    const ddx = cx - px, ddy = cy - py;
    return ddx * ddx + ddy * ddy <= r * r;
  };

  // Segment/circle entry and exit parameters. An origin inside the circle
  // reports t0=0 so callers can test visibility without a special case.
  U.segCircleHit = (x1, y1, x2, y2, cx, cy, r) => {
    const dx = x2 - x1, dy = y2 - y1;
    const fx = x1 - cx, fy = y1 - cy;
    const a = dx * dx + dy * dy;
    const rr = Math.max(0, r) * Math.max(0, r);
    if (a <= 1e-12) {
      if (fx * fx + fy * fy > rr) return null;
      return { t0: 0, t1: 1, t: 0 };
    }
    const b = fx * dx + fy * dy;
    const c = fx * fx + fy * fy - rr;
    const disc = b * b - a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    let t0 = (-b - root) / a;
    let t1 = (-b + root) / a;
    if (t1 < 0 || t0 > 1) return null;
    if (t0 < 0) t0 = 0;
    if (t1 > 1) t1 = 1;
    return { t0, t1, t: t0 };
  };

  // Slab test for a segment against an axis-aligned rectangle. Returns the
  // entry/exit parameters and the outward normal at entry.
  U.segmentRect = (x1, y1, x2, y2, rc, pad = 0) => {
    if (!rc) return null;
    const minX = rc.x - pad, maxX = rc.x + rc.w + pad;
    const minY = rc.y - pad, maxY = rc.y + rc.h + pad;
    const dx = x2 - x1, dy = y2 - y1;
    let t0 = 0, t1 = 1;
    let nx = 0, ny = 0;

    const slab = (p, d, lo, hi, axis) => {
      if (Math.abs(d) < 1e-12) return p >= lo && p <= hi;
      let a = (lo - p) / d;
      let b = (hi - p) / d;
      let nearLo = true;
      if (a > b) {
        const q = a; a = b; b = q;
        nearLo = false;
      }
      if (a > t0) {
        t0 = a;
        nx = axis === 0 ? (nearLo ? -1 : 1) : 0;
        ny = axis === 1 ? (nearLo ? -1 : 1) : 0;
      }
      if (b < t1) t1 = b;
      return t0 <= t1;
    };

    if (!slab(x1, dx, minX, maxX, 0)) return null;
    if (!slab(y1, dy, minY, maxY, 1)) return null;
    if (t1 < 0 || t0 > 1) return null;
    t0 = U.clamp(t0, 0, 1);
    t1 = U.clamp(t1, 0, 1);
    return { t0, t1, t: t0, nx, ny };
  };

  // Axis-separated, substepped circle movement. It prevents a fast dash or
  // high-speed enemy from crossing a thin wall/corner in one simulation step.
  U.moveCircle = (x, y, r, dx, dy, opt) => {
    opt = opt || {};
    const obstacles = opt.obstacles || [];
    const bounds = opt.bounds || null;
    const maxStep = Math.max(0.5, opt.maxStep || r * 0.45);
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    const steps = Math.max(1, Math.ceil(dist / maxStep));
    const sx = dx / steps, sy = dy / steps;
    let px = x, py = y;
    let hitX = false, hitY = false;

    const inBounds = (tx, ty) => {
      if (!bounds) return true;
      return tx >= bounds.x + r - 0.01 &&
        tx <= bounds.x + bounds.w - r + 0.01 &&
        ty >= bounds.y + r - 0.01 &&
        ty <= bounds.y + bounds.h - r + 0.01;
    };
    const hitsSolid = (tx, ty) => {
      const rr = Math.max(0.01, r - 0.05);
      for (const o of obstacles) {
        if (!o || o.dead || o.solid === false) continue;
        if (U.circleRect(tx, ty, rr, o)) return true;
      }
      return false;
    };

    for (let i = 0; i < steps; i++) {
      if (sx !== 0) {
        let tx = px + sx;
        if (bounds) tx = U.clamp(tx, bounds.x + r, bounds.x + bounds.w - r);
        if (inBounds(tx, py) && !hitsSolid(tx, py)) px = tx;
        else hitX = true;
      }
      if (sy !== 0) {
        let ty = py + sy;
        if (bounds) ty = U.clamp(ty, bounds.y + r, bounds.y + bounds.h - r);
        if (inBounds(px, ty) && !hitsSolid(px, ty)) py = ty;
        else hitY = true;
      }
    }
    return { x: px, y: py, hitX, hitY, steps };
  };
  U.moveCircleAxisSeparated = U.moveCircle;

  // simple object pool-ish helpers
  U.removeDead = (arr) => {
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i].dead) arr.splice(i, 1);
    return arr;
  };

  // ---------- colour ----------
  U.hexToRgb = (hex) => {
    if (typeof hex === 'string' && /^rgba?\(/i.test(hex)) {
      const m = hex.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
      if (m) return { r: Math.round(Number(m[1])), g: Math.round(Number(m[2])), b: Math.round(Number(m[3])) };
    }
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  U.rgba = (hex, a = 1) => {
    const c = U.hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  };
  U.mix = (c1, c2, t) => {
    const a = U.hexToRgb(c1), b = U.hexToRgb(c2);
    const r = Math.round(U.lerp(a.r, b.r, t));
    const g = Math.round(U.lerp(a.g, b.g, t));
    const bl = Math.round(U.lerp(a.b, b.b, t));
    return `rgb(${r},${g},${bl})`;
  };

  // ---------- canvas ----------
  U.makeCanvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };

  // 3x5 pixel digits, drawn with squares
  const DIGITS = {
    0: ['111', '101', '101', '101', '111'],
    1: ['010', '110', '010', '010', '111'],
    2: ['111', '001', '111', '100', '111'],
    3: ['111', '001', '111', '001', '111'],
    4: ['101', '101', '111', '001', '001'],
    5: ['111', '100', '111', '001', '111'],
    6: ['111', '100', '111', '101', '111'],
    7: ['111', '001', '010', '010', '010'],
    8: ['111', '101', '111', '101', '111'],
    9: ['111', '101', '111', '001', '111'],
    '+': ['000', '010', '111', '010', '000'],
    '-': ['000', '000', '111', '000', '000'],
    'x': ['000', '101', '010', '101', '000'],
    '/': ['001', '001', '010', '100', '100'],
    '!': ['010', '010', '010', '000', '010'],
    '$': ['111', '110', '011', '001', '110'],
    '%': ['101', '001', '010', '100', '101'],
    '.': ['000', '000', '000', '000', '010'],
    ':': ['000', '010', '000', '010', '000'],
  };
  U.pixelText = (ctx, text, x, y, scale, color, align = 'left', outline = null) => {
    text = String(text);
    const cw = 4 * scale;
    const total = text.length * cw - scale;
    let ox = x;
    if (align === 'center') ox = x - total / 2;
    else if (align === 'right') ox = x - total;
    if (outline) {
      for (const [dx, dy] of [[-scale, 0], [scale, 0], [0, -scale], [0, scale], [-scale, -scale], [scale, scale], [-scale, scale], [scale, -scale]]) {
        U._pixelTextRaw(ctx, text, ox + dx, y + dy, scale, outline);
      }
    }
    U._pixelTextRaw(ctx, text, ox, y, scale, color);
    return total;
  };
  U._pixelTextRaw = (ctx, text, x, y, scale, color) => {
    ctx.fillStyle = color;
    for (let i = 0; i < text.length; i++) {
      const glyph = DIGITS[text[i]] || DIGITS[text[i].toLowerCase()];
      if (!glyph) continue;
      const gx = x + i * 4 * scale;
      for (let r = 0; r < 5; r++) {
        const row = glyph[r];
        for (let c = 0; c < 3; c++) {
          if (row[c] === '1') ctx.fillRect(gx + c * scale, y + r * scale, scale, scale);
        }
      }
    }
  };

  U.circle = (ctx, x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, U.TAU);
  };
  U.fillCircle = (ctx, x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.1, r), 0, U.TAU);
    ctx.fill();
  };
  U.strokeCircle = (ctx, x, y, r, color, width = 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.1, r), 0, U.TAU);
    ctx.stroke();
  };
  U.roundRect = (ctx, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  U.linear = (ctx, x0, y0, x1, y1, stops) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [p, c] of stops) g.addColorStop(p, c);
    return g;
  };
  U.radial = (ctx, x, y, r0, r1, stops) => {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    for (const [p, c] of stops) g.addColorStop(p, c);
    return g;
  };

  // draw a soft additive glow blob
  U.glow = (ctx, x, y, r, color, alpha = 0.5) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = U.hexToRgb(color);
    g.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${alpha})`);
    g.addColorStop(0.45, `rgba(${c.r},${c.g},${c.b},${alpha * 0.35})`);
    g.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, U.TAU);
    ctx.fill();
  };

  U.clampToRoom = (x, y, r, pad = 30) => ({
    x: U.clamp(x, pad + r, U.W - pad - r),
    y: U.clamp(y, 86 + r, U.H - pad - r),
  });

  // simple string hash for sprite variation
  U.noise1 = (x) => {
    const s = Math.sin(x * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
})();
