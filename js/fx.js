/* ============================================================
   fx.js — particles, damage numbers, shake, hit-stop, beams
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;
  const TAU = Math.PI * 2;

  const FX = (G.FX = {
    parts: [],
    texts: [],
    rings: [],
    beams: [],
    shakeMag: 0,
    shakeT: 0,
    shakeDur: 0.25,
    shakeX: 0,
    shakeY: 0,
    hitstop: 0,
    MAX: 620,
  });

  FX.clear = function () {
    FX.parts.length = 0;
    FX.texts.length = 0;
    FX.rings.length = 0;
    FX.beams.length = 0;
    FX.shakeMag = 0;
    FX.shakeT = 0;
    FX.hitstop = 0;
  };

  FX.shake = function (mag, dur) {
    const settings = G.game ? G.game.settings : G.settings;
    if (settings && !settings.shake) return;
    FX.shakeMag = Math.max(FX.shakeMag, mag);
    FX.shakeDur = dur || 0.22;
    FX.shakeT = Math.max(FX.shakeT, FX.shakeDur);
  };

  FX.stop = function (t) {
    FX.hitstop = Math.max(FX.hitstop, t);
  };

  FX.add = function (p) {
    if (G.game && G.game.settings.reducedFx) return p;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return p;
    if (FX.parts.length >= FX.MAX) return p;
    p.life = p.life == null ? 0.5 : p.life;
    p.maxLife = p.life;
    p.gravity = p.gravity || 0;
    p.drag = p.drag == null ? 0.9 : p.drag;
    p.size = p.size || 2;
    p.rot = p.rot || 0;
    p.vr = p.vr || 0;
    p.alpha = p.alpha == null ? 1 : p.alpha;
    FX.parts.push(p);
    return p;
  };

  FX.spark = function (x, y, ang, speed, color, opt) {
    opt = opt || {};
    return FX.add({
      type: 'spark', x, y,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      life: opt.life || U.rand(0.18, 0.5),
      size: opt.size || U.rand(1.4, 3.2),
      color, gravity: opt.gravity || 0, drag: opt.drag || 0.86,
      glow: opt.glow !== false,
    });
  };

  FX.burst = function (x, y, color, n, opt) {
    opt = opt || {};
    n = n || 10;
    const spd = opt.speed || 180;
    for (let i = 0; i < n; i++) {
      const a = opt.angle == null ? Math.random() * TAU : opt.angle + U.rand(-opt.spread || -0.6, opt.spread || 0.6);
      FX.spark(x, y, a, U.rand(spd * 0.35, spd), color, {
        life: U.rand(0.15, 0.45) * (opt.lifeMul || 1),
        size: U.rand(1.2, 3),
        drag: opt.drag || 0.86,
        gravity: opt.gravity || 0,
      });
    }
  };

  FX.debris = function (x, y, colors, n, opt) {
    opt = opt || {};
    for (let i = 0; i < (n || 8); i++) {
      const c = colors[(Math.random() * colors.length) | 0];
      const a = Math.random() * TAU;
      const sp = U.rand(60, opt.speed || 260);
      FX.add({
        type: 'rect', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: U.rand(0.35, 0.9),
        size: U.rand(2, opt.size || 5),
        w: U.rand(2, opt.size || 6), h: U.rand(1.5, 4),
        color: c, gravity: 520, drag: 0.985, rot: Math.random() * TAU, vr: U.rand(-10, 10),
      });
    }
  };

  FX.paper = function (x, y, n, color) {
    for (let i = 0; i < (n || 4); i++) {
      FX.add({
        type: 'paper', x, y,
        vx: U.rand(-90, 90), vy: U.rand(-160, -30),
        life: U.rand(0.8, 1.6), w: U.rand(6, 11), h: U.rand(4, 7),
        color: color || '#e9e4d2', gravity: 120, drag: 0.985,
        rot: Math.random() * TAU, vr: U.rand(-4, 4),
      });
    }
  };

  FX.smoke = function (x, y, color, n) {
    for (let i = 0; i < (n || 3); i++) {
      FX.add({
        type: 'smoke', x: x + U.rand(-6, 6), y: y + U.rand(-6, 6),
        vx: U.rand(-22, 22), vy: U.rand(-40, -8),
        life: U.rand(0.5, 1.1), size: U.rand(6, 14),
        color: color || 'rgba(120,160,190,0.35)', drag: 0.96,
      });
    }
  };

  FX.hit = function (x, y, ang, color, crit) {
    FX.burst(x, y, color, crit ? 14 : 8, { angle: ang, spread: 0.9, speed: crit ? 260 : 180, drag: 0.85 });
    if (crit) {
      FX.add({ type: 'flash', x, y, size: 22, life: 0.09, color });
      FX.stop(0.035);
    }
  };

  FX.death = function (x, y, color, size) {
    size = size || 1;
    FX.burst(x, y, color, Math.round(12 * size), { speed: 220 * size, drag: 0.88 });
    FX.burst(x, y, '#ffffff', Math.round(5 * size), { speed: 120, drag: 0.9 });
    FX.ring(x, y, 4, 30 * size, color, 0.35, 2);
    FX.debris(x, y, ['#e9e4d2', color, '#ffffff'], Math.round(7 * size), { speed: 200, size: 4 });
    FX.stop(0.045);
    FX.shake(3 * size, 0.18);
  };

  FX.text = function (x, y, str, color, opt) {
    opt = opt || {};
    if (FX.texts.length > 90) FX.texts.shift();
    FX.texts.push({
      x: x + U.rand(-4, 4), y,
      vy: opt.vy == null ? -46 : opt.vy,
      vx: opt.vx == null ? U.rand(-16, 16) : opt.vx,
      life: opt.life || 0.75, maxLife: opt.life || 0.75,
      str: String(str), color: color || '#ffffff',
      scale: opt.scale || 2, crit: !!opt.crit,
      outline: opt.outline === false ? null : '#05070d',
    });
  };

  FX.ring = function (x, y, r0, r1, color, life, width, fill) {
    FX.rings.push({ x, y, r0, r1, color, life: life || 0.4, maxLife: life || 0.4, width: width || 2, fill: !!fill });
  };

  FX.beam = function (x1, y1, x2, y2, color, life) {
    FX.beams.push({ x1, y1, x2, y2, color, life: life || 0.08, maxLife: life || 0.08 });
  };

  FX.flash = function (type) {
    const el = document.getElementById('fx-flash');
    if (!el) return;
    el.className = 'fx-flash';
    void el.offsetWidth;
    el.className = 'fx-flash ' + (type || 'hurt');
  };

  FX.update = function (dt) {
    if (FX.shakeT > 0) {
      FX.shakeT -= dt;
      const k = Math.max(0, FX.shakeT / FX.shakeDur);
      const mag = FX.shakeMag * k * k;
      FX.shakeX = U.rand(-mag, mag);
      FX.shakeY = U.rand(-mag, mag);
      if (FX.shakeT <= 0) { FX.shakeMag = 0; FX.shakeX = 0; FX.shakeY = 0; }
    }
    const ps = FX.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { ps.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.rot += p.vr * dt;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { ps.splice(i, 1); continue; }
    }
    for (let i = FX.texts.length - 1; i >= 0; i--) {
      const t = FX.texts[i];
      t.life -= dt;
      if (t.life <= 0) { FX.texts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.x += t.vx * dt;
      t.vy += 55 * dt;
      t.vx *= Math.pow(0.93, dt * 60);
    }
    for (let i = FX.rings.length - 1; i >= 0; i--) {
      FX.rings[i].life -= dt;
      if (FX.rings[i].life <= 0) FX.rings.splice(i, 1);
    }
    for (let i = FX.beams.length - 1; i >= 0; i--) {
      FX.beams[i].life -= dt;
      if (FX.beams[i].life <= 0) FX.beams.splice(i, 1);
    }
  };

  FX.draw = function (ctx) {
    // beams under particles
    for (const b of FX.beams) {
      const k = b.life / b.maxLife;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = k * 0.7;
      ctx.lineWidth = 2 + k * 2;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    for (const p of FX.rings) {
      const k = 1 - p.life / p.maxLife;
      const r = U.lerp(p.r0, p.r1, U.easeOutCubic(k));
      ctx.globalAlpha = (1 - k) * 0.9;
      if (p.fill) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, r), 0, TAU);
        ctx.fill();
      } else {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width * (1 - k * 0.6);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, r), 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.save();
    for (const p of FX.parts) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a * p.alpha;
      if (p.type === 'smoke') {
        const r = p.size * (1 + (1 - a) * 1.8);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.fill();
      } else if (p.type === 'flash') {
        ctx.globalCompositeOperation = 'lighter';
        U.glow(ctx, p.x, p.y, p.size * (0.5 + (1 - a)), p.color, a * 0.8);
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.type === 'paper') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, 1);
        ctx.restore();
      } else if (p.type === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      } else {
        if (p.glow) {
          ctx.globalCompositeOperation = 'lighter';
          if (p.size > 2.2) U.glow(ctx, p.x, p.y, p.size * 3, p.color, a * 0.22);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fillStyle = p.color;
        const s = p.size * (0.5 + a * 0.5);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    ctx.restore();

    // damage numbers
    for (const t of FX.texts) {
      const k = t.life / t.maxLife;
      const a = k > 0.75 ? U.invLerp(1, 0.75, k) : Math.min(1, k / 0.55);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      const pop = t.crit ? 1 + Math.max(0, (k - 0.8)) * 2.4 : 1;
      U.pixelText(ctx, t.str, Math.round(t.x), Math.round(t.y), Math.round(t.scale * pop), t.color, 'center', t.outline);
      ctx.restore();
    }
  };

  FX.hazardRing = function (ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  };
})();
