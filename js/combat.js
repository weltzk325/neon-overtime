/* ============================================================
   combat.js — deterministic beam geometry, contacts and heat
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;
  const FX = G.FX;

  const Combat = (G.Combat = {
    // All thermal and settlement tuning lives here.
    settleInterval: 0.1,
    displayInterval: 0.2,
    heatUpPerSec: 1 / 6,
    heatCoolPerSec: 1 / 3,
    overheatCoolPerSec: 1 / 3,
    overheatResumeAt: 0.25,
    highHeatAt: 0.78,
    hotResetAt: 0.6,
    obstacleDamageMul: 0.7,
    muzzleOffset: 16,
  });

  const EPS = 1e-9;

  function finite(v, fallback) {
    return Number.isFinite(v) ? v : fallback;
  }

  function play(name, opt) {
    if (G.Audio && typeof G.Audio.play === 'function') G.Audio.play(name, opt);
  }

  Combat.getAimOrigin = function (player) {
    let h = player.aimHeight;
    if (!Number.isFinite(h)) {
      const sp = G.Sprites;
      const char = player.game && player.game.run && player.game.run.character;
      h = sp && sp.playerSprites && sp.playerSprites[char] ? 52 : 26;
    }
    return { x: player.x, y: player.y - h, h };
  };

  Combat.getAimAngle = function (player, tx, ty) {
    const o = Combat.getAimOrigin(player);
    return Math.atan2(ty - o.y, tx - o.x);
  };

  Combat.getTargetPoint = function (target) {
    if (!target) return null;
    const yOff = Number.isFinite(target.hitY) ? target.hitY : 0;
    const r = Number.isFinite(target.hitRadius)
      ? target.hitRadius
      : Math.max(1, finite(target.r, 8));
    return { x: target.x, y: target.y - yOff, r };
  };

  Combat.getObstaclePoint = function (o) {
    return { x: o.x + o.w / 2, y: o.y + o.h / 2, r: Math.max(o.w, o.h) * 0.5 };
  };

  Combat.getLaserDps = function (player) {
    const game = player.game;
    const w = player.weapon;
    const st = player.stats;
    if (!game || !w || !st || !(w.tickDamage > 0) || !(w.tickRate > 0)) return 0;
    const level = Math.max(1, finite(game.run && game.run.weaponLevel, 1));
    const levelMul = 1 + 0.12 * (level - 1);
    const focusMul = player.focus ? 1.12 : 1;
    const damageMul = typeof game.getDamageMul === 'function' ? finite(game.getDamageMul(), 1) : 1;
    const fireRate = Math.max(0, finite(st.fireRate, 1));
    return (w.tickDamage / w.tickRate) * fireRate * levelMul * focusMul * damageMul;
  };

  // The returned line is the one visual beam; every hit test below uses this
  // exact muzzle and endpoint. Enemies never shorten the visible beam.
  Combat.computeBeam = function (player) {
    const game = player.game;
    const w = player.weapon;
    if (!game || !w || !w.beam) return null;
    const origin = Combat.getAimOrigin(player);
    const ang = player.aim;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const muzzle = Math.max(0, finite(Combat.muzzleOffset, 16));
    const beamRadius = Math.max(0, finite(w.beamWidth, 5) * 0.5);
    const obstacles = game.world && game.world.obstacles ? game.world.obstacles : [];
    const muzzleX = origin.x + dx * muzzle;
    const muzzleY = origin.y + dy * muzzle;
    const fullRangeX = origin.x + dx * Math.max(1, finite(w.range, 660));
    const fullRangeY = origin.y + dy * Math.max(1, finite(w.range, 660));
    const bounds = game.world && game.world.bounds || { x: 0, y: 0, w: U.W, h: U.H };
    // A tall sprite can place its hand above the walkable room. A ray pointing
    // away from the room has no visible or damaging segment.
    if (!U.segmentRect(origin.x, origin.y, fullRangeX, fullRangeY, bounds, 0)) return null;

    // The hand can stand within 16px of a thin wall. Check the emitter-to-
    // muzzle segment first so the beam cannot begin on the far side of it.
    let nearBlocker = null;
    let nearT = 1;
    for (const o of obstacles) {
      if (!o || o.dead || o.solid === false) continue;
      const hit = U.segmentRect(origin.x, origin.y, muzzleX, muzzleY, o, beamRadius);
      if (!hit || hit.t0 >= nearT) continue;
      nearBlocker = o;
      nearT = Math.max(0, hit.t0);
    }
    if (nearBlocker) {
      const x2 = origin.x + (muzzleX - origin.x) * nearT;
      const y2 = origin.y + (muzzleY - origin.y) * nearT;
      const hits = nearBlocker.destructible
        ? [{ target: nearBlocker, kind: 'obstacle', t: 1, x: x2, y: y2 }]
        : [];
      return {
        x1: origin.x, y1: origin.y, x2, y2,
        angle: ang,
        originX: origin.x,
        originY: origin.y,
        fullX2: fullRangeX,
        fullY2: fullRangeY,
        blockedBy: nearBlocker,
        hits,
      };
    }

    let x1 = origin.x + dx * muzzle;
    let y1 = origin.y + dy * muzzle;
    const range = Math.max(1, finite(w.range, 660));
    let fullX2 = x1 + dx * range;
    let fullY2 = y1 + dy * range;
    let limitT = 1;
    const room = U.segmentRect(x1, y1, fullX2, fullY2, bounds, 0);
    if (!room) return null;
    const spanX = fullX2 - x1, spanY = fullY2 - y1;
    fullX2 = x1 + spanX * room.t1;
    fullY2 = y1 + spanY * room.t1;
    x1 += spanX * room.t0;
    y1 += spanY * room.t0;

    let blocker = null;
    let blockerT = limitT;
    for (const o of obstacles) {
      if (!o || o.dead || o.solid === false) continue;
      const hit = U.segmentRect(x1, y1, fullX2, fullY2, o, beamRadius);
      if (!hit || hit.t0 > blockerT + EPS) continue;
      blocker = o;
      blockerT = Math.max(0, hit.t0);
    }
    limitT = U.clamp(blockerT, 0, 1);

    const x2 = x1 + (fullX2 - x1) * limitT;
    const y2 = y1 + (fullY2 - y1) * limitT;
    const hits = [];

    if (blocker && blocker.destructible) {
      hits.push({
        target: blocker,
        kind: 'obstacle',
        t: limitT,
        x: x2,
        y: y2,
      });
    }

    const addTarget = (target, kind) => {
      if (!target || target.dead) return;
      const p = Combat.getTargetPoint(target);
      if (!p) return;
      const hit = U.segCircleHit(x1, y1, x2, y2, p.x, p.y, p.r + beamRadius);
      if (!hit || hit.t0 > 1 + EPS) return;
      hits.push({ target, kind, t: hit.t0, x: p.x, y: p.y, r: p.r });
    };

    for (const e of game.enemies || []) addTarget(e, 'enemy');
    if (game.boss && !game.boss.dead) addTarget(game.boss, 'boss');
    hits.sort((a, b) => a.t - b.t);

    return {
      x1, y1, x2, y2,
      angle: ang,
      originX: origin.x,
      originY: origin.y,
      fullX2, fullY2,
      blockedBy: blocker,
      hits,
    };
  };

  Combat.updateHeat = function (player, dt, emitting) {
    dt = Math.max(0, finite(dt, 0));
    player.laserHeat = U.clamp(finite(player.laserHeat, 0), 0, 1);
    player.laserOverheated = !!player.laserOverheated;

    if (player.laserOverheated) {
      player.laserHeat = Math.max(0, player.laserHeat - Combat.overheatCoolPerSec * dt);
      if (player.laserHeat <= Combat.overheatResumeAt + EPS) {
        player.laserHeat = Math.min(player.laserHeat, Combat.overheatResumeAt);
        player.laserOverheated = false;
        player.laserHotWarned = false;
        play('pickup', { pitch: 0.72 });
        return { activeDt: 0, overheatedNow: false, recovered: true };
      }
      return { activeDt: 0, overheatedNow: false, recovered: false };
    }

    if (!emitting) {
      player.laserHeat = Math.max(0, player.laserHeat - Combat.heatCoolPerSec * dt);
      if (player.laserHeat < Combat.hotResetAt) player.laserHotWarned = false;
      return { activeDt: 0, overheatedNow: false, recovered: false };
    }

    const rate = Math.max(EPS, Combat.heatUpPerSec);
    const available = Math.max(0, (1 - player.laserHeat) / rate);
    const activeDt = Math.min(dt, available);
    player.laserHeat = Math.min(1, player.laserHeat + rate * activeDt);

    if (player.laserHeat >= 1 - EPS) {
      player.laserHeat = 1;
      player.laserOverheated = true;
      player.laserHotWarned = false;
      play('deny', { pitch: 0.72 });
      return { activeDt, overheatedNow: true, recovered: false };
    }

    if (!player.laserHotWarned && player.laserHeat >= Combat.highHeatAt) {
      player.laserHotWarned = true;
      play('warn', { pitch: 1.28 });
    }
    return { activeDt, overheatedNow: false, recovered: false };
  };

  function ensureBeamState(player) {
    if (!(player._laserContacts instanceof Map)) player._laserContacts = new Map();
    if (!Number.isFinite(player._laserSettleClock)) player._laserSettleClock = 0;
  }

  function settleEntry(player, entry) {
    const amount = entry.damage;
    entry.damage = 0;
    if (!(amount > 0) || !entry.target || entry.target.dead) return 0;
    const game = player.game;
    let actual = 0;

    if (entry.kind === 'obstacle') {
      const hpBefore = finite(entry.target.hp, 0);
      const ret = game.damageObstacle(entry.target, amount, entry.x, entry.y);
      actual = Number.isFinite(ret)
        ? Math.max(0, ret)
        : Math.max(0, hpBefore - finite(entry.target.hp, hpBefore));
    } else {
      const st = player.stats;
      const ret = game.damageEnemy(entry.target, amount, {
        source: 'laser',
        critChance: typeof game.getCrit === 'function' ? game.getCrit() : 0,
        critMult: finite(st && st.critMult, 1.5),
        angle: player.aim,
        x: entry.x,
        y: entry.y,
        silentParticles: true,
        softHit: true,
      });
      actual = Number.isFinite(ret) ? Math.max(0, ret) : Math.max(0, amount);
    }

    entry.actualDamage += actual;
    entry.pendingDisplay += actual;
    return actual;
  }

  function flushDisplay(entry) {
    const value = entry.pendingDisplay;
    if (!(value > 0)) return;
    entry.pendingDisplay = 0;
    const shown = value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
    FX.text(entry.x, entry.y - 30, shown, '#c9ffd8', { scale: 1.7, life: 0.4 });
    const a = entry.angle == null ? -Math.PI / 2 : entry.angle;
    FX.spark(entry.x, entry.y, a + Math.PI + 0.45, 72, '#bffcff', { life: 0.15, size: 1.8 });
    FX.spark(entry.x, entry.y, a + Math.PI - 0.45, 58, '#ffffff', { life: 0.13, size: 1.5 });
  }

  // Settle the remaining contact on exit/stop. This makes a short tap retain
  // its fraction of a tick without leaking damage into later frames.
  function flushEntry(player, entry) {
    settleEntry(player, entry);
    flushDisplay(entry);
  }

  Combat.updateBeam = function (player, dt) {
    dt = Math.max(0, finite(dt, 0));
    ensureBeamState(player);
    const beam = Combat.computeBeam(player);
    player.beam = beam;
    if (!beam) {
      Combat.flushLaser(player);
      if (G.Audio && typeof G.Audio.stopLaser === 'function') G.Audio.stopLaser();
      return null;
    }

    if (G.Audio && typeof G.Audio.startLaser === 'function') G.Audio.startLaser();
    const game = player.game;
    const dps = Combat.getLaserDps(player);
    const seen = new Set();

    for (const hit of beam.hits) {
      const target = hit.target;
      if (!target || target.dead) continue;
      let entry = player._laserContacts.get(target);
      if (!entry) {
        entry = {
          target,
          kind: hit.kind,
          damage: 0,
          contact: 0,
          actualDamage: 0,
          pendingDisplay: 0,
          displayClock: 0,
          x: hit.x,
          y: hit.y,
          angle: player.aim,
        };
        player._laserContacts.set(target, entry);
      }
      entry.kind = hit.kind;
      entry.x = hit.x;
      entry.y = hit.y;
      entry.angle = player.aim;
      entry.contact += dt;
      entry.displayClock += dt;
      const mul = hit.kind === 'obstacle' ? Combat.obstacleDamageMul : 1;
      entry.damage += dps * mul * dt;
      seen.add(target);
    }

    for (const [target, entry] of Array.from(player._laserContacts)) {
      if (seen.has(target)) continue;
      flushEntry(player, entry);
      player._laserContacts.delete(target);
    }

    for (const entry of player._laserContacts.values()) {
      if (entry.displayClock + EPS < Combat.displayInterval) continue;
      entry.displayClock -= Combat.displayInterval;
      flushDisplay(entry);
    }

    player._laserSettleClock += dt;
    while (player._laserSettleClock + EPS >= Combat.settleInterval) {
      player._laserSettleClock -= Combat.settleInterval;
      for (const entry of player._laserContacts.values()) settleEntry(player, entry);
    }
    if (Math.abs(player._laserSettleClock) < EPS) player._laserSettleClock = 0;
    return beam;
  };

  Combat.flushLaser = function (player) {
    ensureBeamState(player);
    for (const entry of player._laserContacts.values()) flushEntry(player, entry);
    player._laserContacts.clear();
    player._laserSettleClock = 0;
  };

  Combat.clearLaser = function (player) {
    ensureBeamState(player);
    // A reset while paused, dead, or changing rooms must not deal deferred damage.
    for (const entry of player._laserContacts.values()) {
      entry.damage = 0;
      entry.pendingDisplay = 0;
    }
    player._laserContacts.clear();
    player._laserSettleClock = 0;
  };

  Combat.isTargetVisible = function (player, target) {
    const beam = Combat.computeBeam(player);
    if (!beam) return false;
    const p = Combat.getTargetPoint(target);
    if (!p) return false;
    return !!U.segCircleHit(beam.x1, beam.y1, beam.x2, beam.y2, p.x, p.y, p.r + 2.5);
  };
})();
