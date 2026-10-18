/* ============================================================
   sprites.js — hand-built pixel art, obstacles, icons, portraits
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;
  const S = (G.Sprites = {});
  const TAU = Math.PI * 2;

  S.ready = false;
  S.imgAbigail = null;

  // ---------------- painter ----------------
  function mkP(ctx, ox, oy, s, flash, tint) {
    const white = flash > 0.02;
    const fc = white ? (flash > 0.8 ? '#ffffff' : tint || '#ffd9e8') : null;
    return function P(x, y, w, h, c) {
      let use = c;
      if (fc) {
        // partial pixel flash keeps silhouettes readable while constantly hit
        const hsh = (Math.floor(x) * 7 + Math.floor(y) * 13 + Math.floor(w) * 5) % 6;
        if (hsh < 4) use = fc;
      }
      ctx.fillStyle = use;
      ctx.fillRect(Math.round(ox + x * s), Math.round(oy + y * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
    };
  }
  S.mkP = mkP;

  S.shadow = function (ctx, x, y, rx, ry, a) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,' + (a == null ? 0.42 : a) + ')';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  S.aura = function (ctx, x, y, r, color, alpha) {
    U.glow(ctx, x, y, r, color, alpha);
  };

  // ============================================================
  // PLAYERS
  // ============================================================
  S.drawPlayer = function (ctx, charId, x, y, o) {
    o = o || {};
    const t = o.t || 0;
    const walk = o.walk || 0;
    const flip = o.flip ? -1 : 1;
    const aim = o.aim || 0;
    const frames = S.playerFrames && S.playerFrames[charId];
    let sprite = S.playerSprites && S.playerSprites[charId];
    let anim = 'idle';
    if (frames) {
      if (o.attackT > 0 && frames.attack && o.hurtT <= 0) {
        sprite = frames.attack;
        anim = 'attack';
      } else if (o.moving && frames.walk && o.hurtT <= 0 && Math.sin(walk * 9) > 0) {
        sprite = frames.walk;
        anim = 'walk';
      }
    }
    const hasSprite = !!sprite;
    S.shadow(ctx, x, y + 1, hasSprite ? 20 : 16, hasSprite ? 6 : 5, 0.5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    U.glow(ctx, x, y - (hasSprite ? 52 : 30), hasSprite ? 48 : 38, charId === 'ama' ? '#57f4ff' : '#b388ff', 0.07);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (flip < 0) {
      ctx.translate(Math.round(x), 0);
      ctx.scale(-1, 1);
      ctx.translate(-Math.round(x), 0);
    }
    if (hasSprite) {
      const bob = anim === 'walk' ? Math.abs(Math.sin(walk * 9)) * -1.4 : o.moving ? Math.abs(Math.sin(walk * 9)) * -0.8 : Math.sin(t * 2.2) * 0.8;
      const sx = Math.round(x - sprite.width / 2);
      const sy = Math.round(y - sprite.height + bob);
      // simple action module: attack lunge / hurt recoil / dash lean
      if (anim === 'attack') {
        // the attack still reaches toward the viewer-left; mirror it so the arm follows aim
        ctx.translate(Math.round(x), 0);
        ctx.scale(-1, 1);
        ctx.translate(-Math.round(x), 0);
        ctx.translate(Math.cos(aim) * 3, Math.sin(aim) * 1.5);
      } else if (o.hurtT > 0) {
        ctx.translate(-3 * flip, -1);
        ctx.rotate(-0.045 * flip);
      } else if (o.dashT > 0) {
        ctx.translate(Math.round(x), y);
        ctx.rotate(0.075 * flip);
        ctx.translate(-Math.round(x), -y);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, sx, sy);
      const white = S.playerWhites && S.playerWhites[charId];
      if (white && o.flash > 0.02) {
        ctx.globalAlpha = Math.min(0.72, o.flash);
        ctx.drawImage(white, sx, sy);
        ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
      }
      ctx.restore();
      if (!o.hideWeapon && o.showWeapon !== false && charId !== 'ama') {
        drawHeldWeapon(ctx, x, y, aim, o.weapon || 'keyboard', t, o.flash, o.alpha, o.weaponY || 40);
      }
      return;
    }
    if (charId === 'ama') drawAma(ctx, x, y, o, walk, t);
    else drawAbigail(ctx, x, y, o, walk, t);
    ctx.restore();
    if (!o.hideWeapon) drawHeldWeapon(ctx, x, y, aim, o.weapon || 'keyboard', t, o.flash, o.alpha, o.weaponY || 26);
  };

  function legSwing(walk, moving) {
    if (!moving) return 0;
    return Math.sin(walk * 9);
  }

  function drawAbigail(ctx, x, y, o, walk, t) {
    const s = 3;
    const bob = o.moving ? Math.abs(Math.sin(walk * 9)) * -0.9 : Math.sin(t * 2.2) * 0.5;
    const ox = Math.round(x) - 12 * s;
    const oy = Math.round(y) - 30 * s + bob * s;
    const P = mkP(ctx, ox, oy, s, o.flash, '#ffe6f2');
    const C = {
      out: '#05040a', hairD: '#1a0f30', hair: '#2b1850', hairM: '#3c2568',
      hairH: '#6e4fae', hairRim: '#a084e0',
      skin: '#f5d5dc', skinS: '#e3b8c4', skinD: '#c692a2',
      white: '#fffaf4', eye: '#77ff9d', eyeD: '#23c765', pupil: '#102018', eyeGlow: '#ffffff',
      lash: '#2a1630', brow: '#1a0f30',
      coat: '#1a142a', coatH: '#332653', coatR: '#6b56a0',
      shirt: '#e6dff0', tight: '#1d1430', boot: '#574177',
      gem: '#4dff95', gemD: '#1a9e58', mouth: '#8a3448',
      blush: '#ef9fb0', belt: '#2a2042', gold: '#ffd24a', pin: '#f2edff',
    };
    const swing = legSwing(walk, o.moving);
    const l1 = Math.round(swing * 1.2);
    const l2 = -l1;
    const sway = Math.sin(t * 2.1) * 0.5;
    const blink = !!o.blink;

    // long hair behind the body; the body will cover the center, leaving hair at the sides
    P(4, 2, 16, 24, C.out);
    P(3, 6, 2, 19, C.out);
    P(19, 6, 2, 19, C.out);
    P(4, 3, 16, 20, C.hairD);
    P(3, 7, 2, 17, C.hairD);
    P(19, 7, 2, 17, C.hairD);
    P(2, 10, 2, 15, C.hairD);
    P(20, 10, 2, 15, C.hairD);
    P(2, 10, 1, 12, C.hairM);
    P(21, 10, 1, 12, C.hairM);
    P(2, 24, 3, 3, C.hairD);
    P(19, 24, 3, 3, C.hairD);
    P(5, 23, 4, 4, C.hairD);
    P(15, 23, 4, 4, C.hairD);
    P(6, 26, 3, 1, C.hairD);
    P(15, 26, 3, 1, C.hairD);

    // legs / thigh-highs / boots
    P(9, 25 + l1, 3, 3, C.out);
    P(13, 25 + l2, 3, 3, C.out);
    P(9, 25 + l1, 3, 3, C.tight);
    P(13, 25 + l2, 3, 3, C.tight);
    P(9, 28 + l1, 1, 1, C.gem);
    P(13, 28 + l2, 1, 1, C.gem);
    P(7, 28 + l1, 5, 1, C.out);
    P(12, 28 + l2, 5, 1, C.out);
    P(8, 28 + l1, 4, 1, C.boot);
    P(13, 28 + l2, 4, 1, C.boot);

    // A-line skirt / coat tails
    P(4, 21, 16, 1, C.out);
    P(5, 22, 14, 2, C.out);
    P(4, 23, 16, 1, C.out);
    P(5, 22, 14, 2, C.coatH);
    P(6, 22, 12, 2, C.coat);
    P(4, 24, 16, 1, C.coatR);
    P(5, 22, 1, 2, C.coatR);
    P(18, 22, 1, 2, C.coatH);
    P(8, 22, 1, 2, C.coatR);
    P(11, 22, 1, 2, C.coatR);
    P(15, 22, 1, 2, C.coatR);

    // torso: narrow waist, shoulders
    P(6, 14, 12, 8, C.out);
    P(7, 15, 10, 6, C.coat);
    P(8, 15, 8, 1, C.coatH);
    P(7, 15, 1, 6, C.coatR);
    P(16, 15, 1, 6, C.coatH);
    P(7, 20, 10, 1, C.out);
    P(8, 20, 8, 1, C.belt);
    P(11, 20, 1, 1, C.gold);

    // narrow shirt V; no long pendant line
    P(9, 14, 6, 1, C.shirt);
    P(10, 15, 4, 1, C.shirt);
    P(11, 16, 2, 1, C.shirt);
    P(11, 17, 2, 1, C.skin);
    P(8, 14, 2, 2, C.coatH);
    P(14, 14, 2, 2, C.coatH);
    P(10, 15, 1, 1, C.lash);
    P(13, 15, 1, 1, C.lash);

    // arms
    const ay = Math.round(-swing * 0.8);
    P(4, 15 + ay, 3, 7, C.out);
    P(17, 15 - ay, 3, 7, C.out);
    P(5, 16 + ay, 2, 5, C.coat);
    P(17, 16 - ay, 2, 5, C.coat);
    P(5, 16 + ay, 1, 4, C.coatR);
    P(5, 21 + ay, 2, 1, C.skin);
    P(18, 21 - ay, 2, 1, C.skin);
    P(5, 21 + ay, 1, 1, C.skinS);
    P(19, 21 - ay, 1, 1, C.skinS);

    // neck + choker (small gem only)
    P(10, 13, 4, 1, C.skin);
    P(9, 13, 6, 1, C.lash);
    P(12, 13, 1, 1, C.gem);

    // --- small round face ---
    P(7, 3, 10, 10, C.out);
    P(9, 5, 7, 1, C.skin);
    P(8, 6, 9, 1, C.skin);
    P(8, 7, 9, 1, C.skin);
    P(8, 8, 9, 3, C.skin);
    P(9, 11, 7, 1, C.skin);
    P(10, 12, 5, 1, C.skinS);
    // ears
    P(7, 8, 1, 2, C.skin);
    P(16, 8, 1, 2, C.skin);
    // cheek shading
    P(16, 8, 1, 3, C.skinS);
    P(8, 10, 1, 2, C.skinS);

    // fringe and short jaw-framing locks (stop at the chin, no beard)
    P(4, 0, 2, 1, C.out);
    P(8, 0, 1, 1, C.out);
    P(11, 0, 2, 1, C.out);
    P(15, 0, 1, 1, C.out);
    P(5, 0, 1, 1, C.hair);
    P(9, 1, 1, 1, C.hair);
    P(12, 0, 1, 1, C.hair);
    P(16, 1, 1, 1, C.hair);
    P(5, 1, 14, 2, C.hair);
    P(4, 2, 3, 1, C.out);
    P(9, 1, 1, 1, C.out);
    P(13, 0, 2, 1, C.out);
    P(5, 2, 14, 2, C.hair);
    P(5, 4, 4, 2, C.hair);
    P(10, 4, 4, 1, C.hair);
    P(15, 4, 4, 2, C.hair);
    P(6, 6, 1, 1, C.hair);
    P(9, 6, 1, 1, C.hair);
    P(12, 6, 1, 1, C.hair);
    P(15, 6, 1, 1, C.hair);
    P(8, 5, 9, 1, C.hair);
    P(8, 6, 9, 1, C.hair);
    P(7, 7, 10, 1, C.hair);
    P(6, 6, 2, 2, C.hairM);
    P(14, 6, 2, 2, C.hair);
    P(5, 5, 2, 7, C.hair);
    P(17, 5, 2, 7, C.hair);
    P(6, 5, 1, 6, C.hairM);
    P(17, 5, 1, 6, C.hairM);
    // loose long strands outside the shoulders
    P(4, 13, 2, 10, C.hairD);
    P(18, 13, 2, 10, C.hairD);
    P(4, 13, 1, 8, C.hairM);
    P(19, 13, 1, 8, C.hairM);
    P(4, 22, 2, 2, C.hair);
    P(18, 22, 2, 2, C.hair);

    // hair shine / rim / ahoge / pin
    P(6, 2, 4, 1, C.hairH);
    P(11, 2, 3, 1, C.hairM);
    P(5, 3, 2, 1, C.hairH);
    P(15, 3, 2, 1, C.hairH);
    P(4, 6, 1, 7, C.hairRim);
    P(19, 6, 1, 7, C.hairM);
    P(12, 0, 1, 1, C.hair);
    P(19, 4, 1, 4, C.pin);
    P(18, 5, 3, 1, C.pin);
    P(19, 6, 1, 1, C.gem);

    // eyes: 2px sclera + green iris, heavy lash, tired lower lid
    if (blink) {
      P(8, 9, 3, 1, C.lash);
      P(13, 9, 3, 1, C.lash);
      P(8, 10, 3, 1, C.skinS);
      P(13, 10, 3, 1, C.skinS);
    } else {
      P(8, 8, 3, 1, C.lash);
      P(13, 8, 3, 1, C.lash);
      P(8, 9, 3, 2, C.white);
      P(13, 9, 3, 2, C.white);
      P(9, 9, 2, 2, C.eyeD);
      P(14, 9, 2, 2, C.eyeD);
      P(9, 9, 1, 1, C.eye);
      P(14, 9, 1, 1, C.eye);
      P(10, 10, 1, 1, C.pupil);
      P(15, 10, 1, 1, C.pupil);
      P(8, 9, 1, 1, C.eyeGlow);
      P(13, 9, 1, 1, C.eyeGlow);
      P(8, 11, 1, 1, C.skinS);
      P(10, 11, 1, 1, C.skinS);
      P(13, 11, 1, 1, C.skinS);
      P(15, 11, 1, 1, C.skinS);
    }

    // nose, tiny mouth, blush; no blood
    P(12, 12, 1, 1, C.mouth);
    P(7, 11, 2, 1, C.blush);
    P(15, 11, 2, 1, C.blush);
    P(16, 9, 1, 1, C.gem);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ey = y - 30 * s + 9.5 * s;
    U.glow(ctx, x - 7, ey, 8, C.eye, 0.18 + Math.sin(t * 2.3) * 0.04);
    U.glow(ctx, x + 6, ey, 8, C.eye, 0.18 + Math.sin(t * 2.3 + 1) * 0.04);
    U.glow(ctx, x, y - 30 * s + 13.5 * s, 6, C.gem, 0.1);
    ctx.restore();
  }

  function drawAma(ctx, x, y, o, walk, t) {
    const s = 3;
    const bob = o.moving ? Math.abs(Math.sin(walk * 9)) * -0.9 : Math.sin(t * 2) * 0.5;
    const ox = Math.round(x) - 12 * s;
    const oy = Math.round(y) - 30 * s + bob * s;
    const P = mkP(ctx, ox, oy, s, o.flash, '#e6fbff');
    const C = {
      out: '#050b12', hairD: '#102a36', hair: '#1a4352', hairH: '#39788c',
      hairRim: '#77d8e8', skin: '#f6d4b8', skinS: '#d9a98c', skinD: '#b8896e',
      eye: '#bffcff', eyeD: '#31c9d6', eyeGlow: '#ffffff', lash: '#071019',
      hood: '#164556', hoodH: '#266c80', hoodD: '#0a2b38',
      neon: '#57f4ff', shirt: '#dbe3ea', pants: '#0a1420', shoe: '#2a6b7c',
      gold: '#ffd24a', mouth: '#7c4047',
    };
    const swing = legSwing(walk, o.moving);
    const l1 = Math.round(swing * 1.2);
    const l2 = -l1;
    const blink = !!o.blink;

    // back hair + outline
    P(3, 2, 18, 20, C.out);
    P(4, 3, 16, 17, C.hairD);
    P(2, 6, 2, 12, C.out);
    P(20, 6, 2, 12, C.out);
    P(3, 6, 2, 11, C.hairD);
    P(19, 6, 2, 11, C.hairD);
    P(5, 19, 3, 3, C.hairD);
    P(16, 19, 3, 3, C.hairD);

    // bed-head tufts above the band
    P(4, 0, 2, 3, C.out);
    P(7, 0, 2, 2, C.out);
    P(12, 0, 2, 3, C.out);
    P(17, 0, 2, 2, C.out);
    P(19, 1, 2, 2, C.out);
    P(5, 1, 2, 2, C.hair);
    P(8, 1, 2, 1, C.hair);
    P(12, 1, 2, 2, C.hair);
    P(17, 1, 2, 1, C.hair);

    // legs / sneakers
    P(9, 24 + l1, 3, 4, C.out);
    P(13, 24 + l2, 3, 4, C.out);
    P(9, 24 + l1, 3, 3, C.pants);
    P(13, 24 + l2, 3, 3, C.pants);
    P(7, 28 + l1, 5, 1, C.out);
    P(12, 28 + l2, 5, 1, C.out);
    P(8, 28 + l1, 4, 1, C.shoe);
    P(13, 28 + l2, 4, 1, C.shoe);
    P(8, 28 + l1, 4, 1, C.neon);
    P(13, 28 + l2, 4, 1, C.neon);

    // oversized hoodie
    P(6, 14, 12, 10, C.out);
    P(7, 15, 10, 9, C.hood);
    P(8, 15, 8, 3, C.hoodH);
    P(7, 15, 1, 3, C.hairRim);
    P(7, 15, 1, 8, C.hoodD);
    P(16, 15, 1, 8, C.hoodH);
    P(6, 22, 3, 4, C.out);
    P(15, 22, 3, 4, C.out);
    P(6, 22, 3, 3, C.hoodD);
    P(15, 22, 3, 3, C.hoodD);

    // shirt + neon drawstrings + badge
    P(10, 15, 4, 2, C.shirt);
    P(11, 17, 2, 1, C.skin);
    P(9, 17, 1, 4, C.neon);
    P(14, 17, 1, 4, C.neon);
    P(10, 19, 4, 1, C.hoodD);
    P(8, 18, 2, 2, C.gold);
    P(9, 18, 1, 1, C.shirt);

    // arms
    const ay = Math.round(-swing * 0.8);
    P(3, 15 + ay, 3, 7, C.out);
    P(18, 15 - ay, 3, 7, C.out);
    P(4, 16 + ay, 2, 5, C.hood);
    P(18, 16 - ay, 2, 5, C.hood);
    P(4, 21 + ay, 2, 1, C.skin);
    P(18, 21 - ay, 2, 1, C.skin);
    P(4, 21 + ay, 1, 1, C.skinS);
    P(19, 21 - ay, 1, 1, C.skinS);

    // hood bunched behind the neck
    P(5, 12, 4, 3, C.out);
    P(15, 12, 4, 3, C.out);
    P(5, 12, 3, 2, C.hoodD);
    P(16, 12, 3, 2, C.hoodD);
    P(10, 13, 3, 2, C.skin);

    // head
    P(6, 3, 12, 11, C.out);
    P(7, 4, 10, 9, C.skin);
    P(7, 4, 10, 1, C.skinS);
    P(6, 6, 2, 4, C.skin);
    P(16, 6, 2, 4, C.skin);
    P(6, 6, 1, 3, C.skinS);
    P(17, 6, 1, 3, C.skinS);

    // messy bangs
    P(4, 0, 2, 1, C.out);
    P(8, 0, 1, 1, C.out);
    P(12, 0, 2, 1, C.out);
    P(17, 0, 1, 1, C.out);
    P(5, 0, 1, 1, C.hair);
    P(9, 1, 1, 1, C.hair);
    P(13, 0, 1, 1, C.hair);
    P(17, 1, 1, 1, C.hair);
    P(5, 2, 14, 3, C.hair);
    P(4, 4, 3, 4, C.hair);
    P(17, 4, 3, 4, C.hair);
    P(6, 4, 2, 3, C.hair);
    P(9, 4, 2, 2, C.hair);
    P(12, 4, 3, 2, C.hair);
    P(16, 4, 2, 3, C.hair);
    P(4, 7, 2, 9, C.hair);
    P(18, 7, 2, 9, C.hair);
    P(15, 7, 2, 4, C.skinS);
    P(7, 6, 9, 1, C.skinS);
    P(5, 4, 12, 2, C.hair);
    P(4, 5, 2, 2, C.hair);
    P(17, 5, 2, 2, C.hair);
    P(6, 5, 1, 2, C.hair);
    P(9, 5, 2, 1, C.hair);
    P(13, 5, 1, 2, C.hair);
    P(16, 5, 1, 1, C.hair);
    P(6, 6, 11, 1, C.hair);
    P(7, 7, 1, 1, C.hair);
    P(10, 7, 2, 1, C.hairM);
    P(13, 7, 1, 1, C.hair);
    P(6, 7, 1, 4, C.hairM);
    P(16, 7, 1, 4, C.hairM);
    P(6, 7, 2, 1, C.hair);
    P(11, 7, 3, 1, C.hair);
    P(16, 7, 1, 1, C.hair);
    P(10, 14, 4, 1, C.hoodD);

    // hair light + rim
    P(6, 2, 5, 1, C.hairH);
    P(12, 2, 3, 1, C.hairH);
    P(5, 3, 2, 1, C.hairRim);
    P(15, 3, 2, 1, C.hairH);
    P(4, 7, 1, 5, C.hairRim);
    P(12, 0, 1, 2, C.hair);
    P(13, 0, 1, 1, C.hairH);

    // headphones: band + cyan cups
    P(5, 1, 12, 1, C.out);
    P(6, 1, 10, 1, C.hoodH);
    P(2, 6, 2, 6, C.out);
    P(19, 6, 2, 6, C.out);
    P(2, 7, 2, 4, C.hoodD);
    P(19, 7, 2, 4, C.hoodD);
    P(2, 8, 1, 2, C.neon);
    P(20, 8, 1, 2, C.neon);
    P(4, 8, 1, 3, C.out);
    P(18, 8, 1, 3, C.out);

    // tired bright eyes
    if (blink) {
      P(8, 8, 3, 1, C.lash);
      P(14, 8, 3, 1, C.lash);
      P(8, 9, 3, 1, C.skinS);
      P(14, 9, 3, 1, C.skinS);
    } else {
      P(7, 7, 4, 1, C.lash);
      P(14, 7, 4, 1, C.lash);
      P(8, 8, 3, 3, C.eyeD);
      P(14, 8, 3, 3, C.eyeD);
      P(8, 8, 2, 2, C.eye);
      P(14, 8, 2, 2, C.eye);
      P(8, 8, 1, 1, C.eyeGlow);
      P(14, 8, 1, 1, C.eyeGlow);
      P(9, 10, 1, 1, C.out);
      P(15, 10, 1, 1, C.out);
      P(8, 11, 2, 1, C.skinD);
      P(14, 11, 2, 1, C.skinD);
    }

    // nose, tired smile, chin
    P(12, 10, 1, 1, C.skinS);
    P(11, 12, 2, 1, C.mouth);
    P(10, 13, 1, 1, C.mouth);
    P(12, 13, 1, 1, C.skinS);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ey = y - 30 * s + 8.5 * s;
    U.glow(ctx, x - 9, ey, 9, C.eye, 0.16 + Math.sin(t * 2) * 0.04);
    U.glow(ctx, x + 9, ey, 9, C.eye, 0.16 + Math.sin(t * 2 + 1) * 0.04);
    U.glow(ctx, x - 30, y - 22 * s, 14, C.neon, 0.12);
    U.glow(ctx, x + 30, y - 22 * s, 14, C.neon, 0.12);
    ctx.restore();
  }

  // weapon held in hand, drawn in screen space rotated toward aim
  function drawHeldWeapon(ctx, x, y, aim, kind, t, flash, alpha, anchorY) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(Math.round(x), Math.round(y) - (anchorY || 26));
    // Hold the tool in the hand at the character's side, not at the body center.
    ctx.translate(Math.cos(aim) >= 0 ? 9 : -9, 0);
    ctx.rotate(aim);
    const col = flash > 0 ? '#fff' : kind === 'laser' ? '#7dffa8' : kind === 'stapler' ? '#ffd24a' : '#57f4ff';
    // small glove/hand pixel so the tool reads as held
    ctx.fillStyle = flash > 0 ? '#fff' : '#d8b8aa';
    ctx.fillRect(-2, -2, 4, 4);
    ctx.fillStyle = '#8c6f68';
    ctx.fillRect(-2, 1, 4, 1);
    if (kind === 'stapler') {
      ctx.fillStyle = '#0a1220';
      ctx.fillRect(2, -7, 22, 10);
      ctx.fillStyle = kind === 'stapler' ? '#3a4660' : '#2b3d55';
      ctx.fillRect(3, -6, 20, 4);
      ctx.fillStyle = col;
      ctx.fillRect(18, -5, 5, 2);
      ctx.fillStyle = '#7a8aa8';
      ctx.fillRect(5, 1, 4, 6);
      ctx.fillStyle = '#111a2b';
      ctx.fillRect(19, -8, 5, 3);
      ctx.fillStyle = col;
      ctx.fillRect(22, -7, 2, 1);
    } else if (kind === 'laser') {
      ctx.fillStyle = '#0a1220';
      ctx.fillRect(1, -4, 19, 7);
      ctx.fillStyle = '#2c3a52';
      ctx.fillRect(2, -3, 17, 3);
      ctx.fillStyle = col;
      ctx.fillRect(16, -2, 7, 2);
      ctx.fillStyle = '#1a2436';
      ctx.fillRect(6, 3, 3, 5);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = col;
      ctx.globalAlpha = (alpha == null ? 1 : alpha) * (0.5 + Math.sin(t * 18) * 0.2);
      ctx.fillRect(21, -2, 6, 1);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // keyboard
      ctx.fillStyle = '#0a1220';
      ctx.fillRect(2, -6, 19, 10);
      ctx.fillStyle = '#26374f';
      ctx.fillRect(3, -5, 17, 6);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#5df1ff' : '#8fa4c0';
        ctx.fillRect(4 + i * 4, -4, 2, 2);
        ctx.fillStyle = '#8fa4c0';
        ctx.fillRect(4 + i * 4, -1, 2, 1);
      }
      ctx.fillStyle = col;
      ctx.fillRect(9, 3, 6, 1);
    }
    ctx.restore();
  }

  // ============================================================
  // ENEMIES
  // ============================================================
  S.drawEnemy = function (ctx, type, x, y, o) {
    o = o || {};
    const t = o.t || 0;
    S.shadow(ctx, x, y + 1, o.shadowR || 14, 4.5, 0.42);
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    switch (type) {
      case 'paper': drawPaper(ctx, x, y, o, t); break;
      case 'printer': drawPrinter(ctx, x, y, o, t); break;
      case 'zombie': drawZombie(ctx, x, y, o, t); break;
      case 'ghost': drawGhost(ctx, x, y, o, t); break;
      case 'drone': drawDrone(ctx, x, y, o, t); break;
      case 'supervisor': drawSupervisor(ctx, x, y, o, t); break;
      default: drawPaper(ctx, x, y, o, t);
    }
    ctx.restore();
  };

  function drawPaper(ctx, x, y, o, t) {
    const s = 3;
    const hov = Math.sin(t * 3 + x * 0.05) * 3;
    const ox = Math.round(x) - 7 * s;
    const oy = Math.round(y) - 13 * s + Math.round(hov);
    const P = mkP(ctx, ox, oy, s, o.flash, '#fff8e8');
    const white = '#e9e4d2';
    const d = '#b9b3a0';
    const dd = '#8c8776';
    // crumpled paper blob
    P(3, 2, 8, 1, white);
    P(1, 3, 12, 2, white);
    P(0, 5, 14, 5, white);
    P(1, 10, 12, 2, white);
    P(3, 12, 8, 1, white);
    P(2, 10, 10, 1, d);
    P(1, 5, 2, 5, d);
    P(12, 4, 2, 6, d);
    P(4, 6, 1, 4, dd);
    P(8, 3, 1, 3, dd);
    P(9, 8, 3, 1, dd);
    P(4, 11, 4, 1, dd);
    // red eyes
    P(4, 6, 2, 2, '#ff3d5e');
    P(9, 6, 2, 2, '#ff3d5e');
    P(4, 6, 2, 1, '#ffd0d8');
    P(9, 6, 2, 1, '#ffd0d8');
    // paper bits
    P(12, 1, 2, 2, white);
    P(-1, 2, 2, 3, white);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    U.glow(ctx, x - 8, y - 26, 11, '#ff3d5e', 0.18);
    U.glow(ctx, x + 8, y - 26, 11, '#ff3d5e', 0.18);
    ctx.restore();
  }

  function drawPrinter(ctx, x, y, o, t) {
    const s = 3;
    const ox = Math.round(x) - 10 * s;
    const oy = Math.round(y) - 16 * s;
    const P = mkP(ctx, ox, oy, s, o.flash, '#dff6ff');
    const body = '#2b3448', bodyL = '#3f4d68', dark = '#101625', accent = '#ff3d5e', screen = '#57f4ff';
    // little legs
    P(2, 14, 2, 2, dark);
    P(16, 14, 2, 2, dark);
    // paper tray / output
    P(5, 0, 10, 2, '#e9e4d2');
    P(6, 1, 8, 1, '#c9c3b1');
    P(7, -1, 6, 1, '#f4efdd');
    // top lid
    P(2, 2, 16, 3, bodyL);
    P(3, 2, 14, 1, '#5a6c8c');
    P(4, 3, 4, 2, dark);
    P(12, 3, 5, 2, dark);
    // main body
    P(1, 5, 18, 9, body);
    P(2, 5, 16, 2, bodyL);
    // vents
    for (let i = 0; i < 4; i++) P(3 + i * 2, 7, 1, 2, dark);
    // status panel
    P(11, 6, 6, 4, dark);
    P(12, 7, 4, 2, screen);
    P(12, 7, 1, 2, '#0a1220');
    // eye / scanline
    const scan = Math.sin(t * 2) * 1;
    P(3, 9 + Math.round(scan * 0.5) * 0.5, 6, 2, accent);
    P(4, 9, 4, 1, '#ffb3bd');
    // output slot
    P(3, 12, 12, 1, dark);
    P(5, 11, 8, 1, '#0a0f18');
    // feet
    P(2, 13, 3, 1, '#1a2233');
    P(15, 13, 3, 1, '#1a2233');
    // glowing LED
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    U.glow(ctx, x + 22, y - 27, 8, accent, 0.35 + Math.sin(t * 5) * 0.2);
    U.glow(ctx, x - 18, y - 33, 10, screen, 0.12);
    ctx.restore();
  }

  function drawZombie(ctx, x, y, o, t) {
    const s = 3;
    const wob = Math.sin(t * 4 + x * 0.02) * 1;
    const ox = Math.round(x) - 9 * s;
    const oy = Math.round(y) - 21 * s + Math.round(wob);
    const P = mkP(ctx, ox, oy, s, o.flash, '#e2ffd6');
    const skin = '#7eae6e', skinD = '#5b8950', suit = '#33394b', suitD = '#232838', tie = '#b23a4a', shirt = '#cdd4de', eye = '#ffe14d';
    // legs
    P(5, 17, 3, 3, suitD);
    P(11, 17, 3, 3, suitD);
    P(5, 20, 3, 1, '#161a24');
    P(11, 20, 3, 1, '#161a24');
    // torso
    P(4, 9, 11, 8, suit);
    P(5, 9, 9, 2, shirt);
    P(9, 9, 2, 8, tie);
    P(10, 12, 1, 3, tie);
    P(4, 9, 2, 6, suitD);
    P(13, 9, 2, 6, suitD);
    // arms reaching forward
    P(13, 10, 6, 2, suit);
    P(17, 10, 2, 2, skin);
    P(14, 12, 5, 2, suitD);
    P(18, 12, 2, 2, skin);
    // coffee cup
    P(17, 8, 2, 2, '#e8e4d3');
    P(19, 8, 1, 1, '#7a4a2a');
    P(18, 7, 1, 1, '#6b4426');
    // head
    P(6, 3, 8, 7, skin);
    P(6, 2, 8, 2, '#2a2e3a');
    P(5, 3, 2, 3, '#2a2e3a');
    P(7, 2, 3, 1, '#454b5c');
    // eyes / mouth
    P(7, 6, 2, 2, '#101318');
    P(11, 6, 2, 2, '#101318');
    P(7, 6, 1, 1, eye);
    P(11, 6, 1, 1, eye);
    P(8, 9, 4, 1, '#3a2424');
    P(9, 9, 2, 1, '#8f3434');
    // stains
    P(6, 12, 1, 2, '#5f3f2a');
    P(12, 14, 2, 1, '#5f3f2a');
    // dangling tie
    P(9, 15, 2, 2, tie);
  }

  function drawGhost(ctx, x, y, o, t) {
    const s = 3;
    const fl = Math.sin(t * 2.2) * 3;
    const ox = Math.round(x) - 7 * s;
    const oy = Math.round(y) - 20 * s + Math.round(fl);
    const P = mkP(ctx, ox, oy, s, o.flash, '#e6ffff');
    const wh = '#cfe3ee', whD = '#9db9c9', tie = '#293344', eye = '#57f4ff';
    ctx.globalAlpha *= 0.82;
    // wispy body
    P(3, 1, 8, 2, wh);
    P(2, 3, 10, 3, wh);
    P(2, 6, 10, 7, wh);
    P(1, 9, 1, 3, wh);
    P(13, 9, 1, 3, wh);
    P(3, 13, 2, 2, wh);
    P(6, 13, 2, 1, wh);
    P(9, 13, 2, 2, wh);
    P(12, 13, 2, 1, wh);
    P(4, 15, 1, 2 + Math.round(Math.sin(t * 4) * 0.5), whD);
    P(9, 15, 1, 3, whD);
    // shirt + tie
    P(4, 7, 7, 5, ww());
    function ww() { return '#eef7fb'; }
    P(7, 8, 1, 3, tie);
    P(7, 11, 2, 1, tie);
    // head
    P(4, 2, 7, 6, '#e8f3f8');
    P(5, 3, 5, 4, wh);
    // tired eyes
    P(5, 5, 2, 1, eye);
    P(9, 5, 2, 1, eye);
    P(5, 6, 1, 1, '#7d99a8');
    P(9, 6, 1, 1, '#7d99a8');
    P(5, 4, 1, 1, '#5b7382');
    P(9, 4, 1, 1, '#5b7382');
    P(7, 7, 2, 1, '#7d99a8');
    // glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    U.glow(ctx, x, y - 32, 26, '#57f4ff', 0.13);
    ctx.restore();
  }

  function drawDrone(ctx, x, y, o, t) {
    const s = 3;
    const hov = Math.sin(t * 3.4) * 3;
    const ox = Math.round(x) - 9 * s;
    const oy = Math.round(y) - 13 * s + Math.round(hov);
    const P = mkP(ctx, ox, oy, s, o.flash, '#ffe6e6');
    const body = '#3a4152', bodyD = '#222734', metal = '#6b768c', red = '#ff3d5e';
    // rotor arms
    P(0, 3, 3, 1, metal);
    P(15, 3, 3, 1, metal);
    P(0, 2, 2, 1, '#8a96ad');
    P(16, 2, 2, 1, '#8a96ad');
    const blur = Math.sin(t * 40) * 1;
    P(0 + blur * 0.5, 1, 3, 1, '#8a96ad');
    P(15 + blur * 0.5, 1, 3, 1, '#8a96ad');
    // shell
    P(4, 4, 10, 2, bodyD);
    P(3, 6, 12, 5, body);
    P(4, 6, 10, 1, metal);
    P(5, 10, 8, 2, bodyD);
    P(6, 12, 6, 1, '#151a24');
    // eye
    P(6, 7, 6, 3, '#0a0d14');
    P(7, 7, 4, 2, red);
    P(8, 7, 2, 1, '#ffc7cf');
    P(9, 8, 1, 1, '#ffc7cf');
    // antenna
    P(8, 1, 1, 3, metal);
    P(8, 0, 1, 1, red);
    // under light
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x, y - 18, x, y + 8);
    g.addColorStop(0, 'rgba(255,61,94,0.22)');
    g.addColorStop(1, 'rgba(255,61,94,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 12); ctx.lineTo(x + 4, y - 12); ctx.lineTo(x + 12, y + 8); ctx.lineTo(x - 12, y + 8);
    ctx.fill();
    U.glow(ctx, x, y - 30, 12, red, 0.25);
    ctx.restore();
  }

  function drawSupervisor(ctx, x, y, o, t) {
    const s = 3;
    const ox = Math.round(x) - 12 * s;
    const oy = Math.round(y) - 26 * s;
    const P = mkP(ctx, ox, oy, s, o.flash, '#fff0d0');
    const suit = '#262b3d', suitL = '#3a4157', shirt = '#e5e9f2', tie = '#e02d4f', skin = '#e8bc9b', gold = '#ffd24a';
    // legs
    P(6, 21, 4, 4, '#181c28');
    P(14, 21, 4, 4, '#181c28');
    P(5, 25, 5, 1, '#0b0d13');
    P(14, 25, 5, 1, '#0b0d13');
    // torso
    P(4, 10, 16, 11, suit);
    P(6, 10, 12, 3, shirt);
    P(10, 10, 3, 9, tie);
    P(11, 15, 1, 3, tie);
    P(3, 10, 3, 9, suitL);
    P(19, 10, 3, 9, suitL);
    P(9, 19, 6, 2, '#141822');
    // shoulders
    P(2, 9, 5, 3, suitL);
    P(17, 9, 5, 3, suitL);
    P(2, 9, 3, 1, gold);
    P(19, 9, 3, 1, gold);
    // arms + briefcase
    P(1, 13, 3, 7, suit);
    P(20, 13, 3, 7, suit);
    P(1, 19, 3, 2, skin);
    P(20, 19, 3, 2, skin);
    P(1, 21, 5, 4, '#3d2b1f');
    P(2, 21, 3, 1, gold);
    // head
    P(7, 3, 10, 8, skin);
    P(7, 2, 10, 2, '#23262f');
    P(6, 3, 2, 3, '#23262f');
    P(17, 3, 2, 3, '#23262f');
    P(8, 2, 3, 1, '#3b3f4d');
    // angry eyes / glasses
    P(8, 6, 3, 2, '#0d1016');
    P(13, 6, 3, 2, '#0d1016');
    P(9, 6, 1, 1, '#ff6d5e');
    P(14, 6, 1, 1, '#ff6d5e');
    P(8, 5, 8, 1, '#c9a227');
    P(11, 9, 3, 1, '#8a5a44');
    P(9, 9, 2, 1, '#8a5a44');
    // tie clip glow
    P(11, 12, 1, 1, gold);
    // shield ring when armored
    if (o.armored) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,210,74,' + (0.45 + Math.sin(t * 4) * 0.15) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y - 30, 42, 52, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ============================================================
  // BOSS — 周报魔王 KPI-0
  // ============================================================
  S.drawBoss = function (ctx, x, y, o) {
    o = o || {};
    const t = o.t || 0;
    const phase = o.phase || 1;
    const s = 4;
    const ox = Math.round(x) - 24 * s;
    const oy = Math.round(y) - 34 * s;
    const P = mkP(ctx, ox, oy, s, 0, '#fff0f0');
    const dark = '#141019', body = '#252030', bodyL = '#3b3450', metal = '#5a526e';
    const red = phase >= 3 ? '#ff2d3d' : phase === 2 ? '#ff7a2d' : '#ff3d5e';
    const gold = '#ffd24a';
    const breathe = Math.sin(t * 1.8) * 2;

    // shadow
    S.shadow(ctx, x, y + 2, 96, 14, 0.55);

    // paper wings behind
    ctx.save();
    ctx.globalAlpha = 0.9;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        const ang = side * (0.5 + i * 0.28) + Math.sin(t * 2 + i) * 0.05;
        ctx.save();
        ctx.translate(x + side * 62, y - 74 - i * 12);
        ctx.rotate(ang);
        ctx.fillStyle = i === 1 ? '#e3ddca' : '#cfc9b6';
        ctx.fillRect(0, -9, side * (36 + i * 12), 18);
        ctx.fillStyle = '#a9a390';
        ctx.fillRect(0, -9, side * 8, 18);
        ctx.fillStyle = '#8c8675';
        for (let k = 0; k < 4; k++) ctx.fillRect(side * (10 + k * 8), -6 + (k % 2) * 6, side * 4, 2);
        ctx.restore();
      }
    }
    ctx.restore();

    // rough cable tentacles
    if (G.roughGen) {
      ctx.save();
      for (let side = -1; side <= 1; side += 2) {
        const pts = [];
        for (let i = 0; i <= 5; i++) {
          const p = i / 5;
          pts.push([
            x + side * (70 + p * 100),
            y - 30 + p * 20 + Math.sin(t * 2.2 + p * 4 + (side > 0 ? 2 : 0)) * (10 + p * 18),
          ]);
        }
        const shape = G.roughGen.curve(pts, {
          stroke: side > 0 ? '#ff3d5e' : '#57f4ff',
          strokeWidth: 2.2,
          roughness: 1.4,
          seed: Math.floor(t * 2) + (side > 0 ? 3 : 9),
        });
        G.Rough.drawShape(ctx, shape);
      }
      ctx.restore();
    }

    // rollers / treads
    P(3, 32, 42, 3, '#0b0a10');
    P(5, 29, 38, 4, '#211d2b');
    for (let i = 0; i < 6; i++) {
      P(6 + i * 6, 30, 4, 2, '#353047');
      P(6 + i * 6, 33, 4, 1, '#454055');
    }

    // main body
    P(5, 10 + breathe * 0.1, 38, 20, body);
    P(4, 12, 40, 16, body);
    P(4, 12, 40, 2, bodyL);
    P(4, 12, 2, 16, '#1b1724');
    P(42, 12, 2, 16, '#1b1724');
    // side rails + status lights
    P(4, 13, 1, 13, metal);
    P(43, 13, 1, 13, metal);
    P(6, 12, 3, 1, gold);
    P(39, 12, 3, 1, '#57f4ff');
    for (let i = 0; i < 3; i++) P(6, 16 + i * 3, 1, 1, red);
    for (let i = 0; i < 3; i++) P(41, 16 + i * 3, 1, 1, '#57f4ff');
    // armor plates
    P(7, 15, 14, 11, bodyL);
    P(25, 15, 12, 11, bodyL);
    P(8, 16, 12, 1, metal);
    P(26, 16, 10, 1, metal);
    P(10, 22, 8, 2, dark);
    P(27, 22, 8, 2, dark);
    // glowing cracks
    P(21, 15, 1, 12, red);
    P(23, 17, 1, 8, red);
    // lower vent grille
    P(8, 27, 32, 1, '#0e0b12');
    for (let i = 0; i < 8; i++) P(9 + i * 4, 27, 2, 1, metal);
    P(10, 29, 28, 1, red);
    // center eye housing
    P(14, 12, 20, 9, '#0a0810');
    P(15, 13, 18, 7, '#1a0b13');
    // big eye
    const eyeR = 6.5;
    const ex = x + 0, ey = y - 34 * s + 16.5 * s;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    U.glow(ctx, ex, ey, 46, red, 0.32 + Math.sin(t * 3) * 0.08);
    ctx.restore();
    ctx.fillStyle = '#0a0509';
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeR * 3, eyeR * 2.4, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = metal;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeR * 3.5, eyeR * 2.9, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = U.rgba(red, 0.6);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeR * 3.9, eyeR * 3.2, 0, 0, TAU);
    ctx.stroke();
    const look = o.eyeDir || 0;
    ctx.fillStyle = red;
    ctx.beginPath();
    ctx.ellipse(ex + Math.cos(look) * 3, ey + Math.sin(look) * 2, eyeR * 1.9, eyeR * 1.9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff2d8';
    ctx.beginPath();
    ctx.ellipse(ex + Math.cos(look) * 3 - 2, ey + Math.sin(look) * 2 - 2, 2.4, 2.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2a0208';
    ctx.beginPath();
    ctx.ellipse(ex + Math.cos(look) * 4, ey + Math.sin(look) * 3, 1.6, 3.5, 0, 0, TAU);
    ctx.fill();

    // crown / KPI spikes
    P(12, 6, 24, 3, '#3a2a12');
    for (let i = 0; i < 4; i++) {
      const h = 3 + i % 2;
      P(13 + i * 6, 6 - h, 4, h, gold);
      P(13 + i * 6, 6 - h, 4, 1, '#fff0a8');
    }
    P(12, 6, 24, 1, gold);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    U.glow(ctx, x, y - 118, 34, gold, 0.18 + Math.sin(t * 2.4) * 0.05);
    ctx.restore();
    // ticker screen
    P(8, 25, 32, 6, '#08070c');
    P(9, 26, 30, 4, '#1a0a10');
    // KPI bars
    P(10, 27, 4, 2, red);
    P(15, 26, 3, 3, '#ff8a5e');
    P(19, 27, 5, 2, '#ffb35e');
    P(25, 26, 2, 3, '#ffd24a');
    P(28, 27, 3, 2, red);
    P(40, 27, 3, 2, '#57f4ff');
    ctx.save();
    U.pixelText(ctx, 'KPI 0', x - 48, y - 30, 2, red, 'left', '#000');
    ctx.globalAlpha = 0.55 + Math.sin(t * 8) * 0.2;
    U.pixelText(ctx, 'DEADLINE', x + 2, y - 18, 1, '#ffb0a8');
    ctx.restore();

    // left/right arms (mechanical)
    for (const side of [-1, 1]) {
      const ax = x + side * 78;
      const ay = y - 108 + Math.sin(t * 2 + (side > 0 ? 1.7 : 0)) * 6;
      ctx.save();
      ctx.fillStyle = '#100d16';
      ctx.fillRect(ax - 10, ay, 20, 26);
      ctx.fillStyle = '#2e2839';
      ctx.fillRect(ax - 8, ay + 2, 16, 22);
      ctx.fillStyle = '#4a4258';
      ctx.fillRect(ax - 7, ay + 4, 14, 3);
      ctx.fillStyle = red;
      ctx.fillRect(ax - 5, ay + 10, 10, 2);
      // clamp fist
      ctx.fillStyle = '#191420';
      ctx.fillRect(ax - 12, ay + 24, 24, 12);
      ctx.fillStyle = '#3a3348';
      ctx.fillRect(ax - 10, ay + 26, 20, 8);
      ctx.fillStyle = red;
      ctx.fillRect(ax - 2, ay + 28, 4, 4);
      ctx.restore();
    }

    // exhaust paper particles handled by fx layer
    // core when phase 3
    if (phase >= 3) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      U.glow(ctx, x, y - 116, 80, '#ff2d3d', 0.15);
      ctx.restore();
    }
    // phase 2 extra cracks
    if (phase >= 2) {
      P(8, 18, 1, 6, red);
      P(39, 18, 1, 6, red);
      P(10, 27, 4, 1, red);
      P(33, 27, 4, 1, red);
    }
  };

  // ============================================================
  // PICKUPS
  // ============================================================
  S.drawTurret = function (ctx, x, y, o) {
    o = o || {};
    const t = o.t || 0;
    const s = 4;
    const bob = Math.sin(t * 4) * 1;
    const ox = Math.round(x) - 7 * s;
    const oy = Math.round(y) - 15 * s + Math.round(bob);
    ctx.save();
    if (o.flash) ctx.globalAlpha = 0.35 + Math.sin(t * 30) * 0.2;
    S.shadow(ctx, x, y + 1, 22, 6, 0.45);
    // life ring
    const frac = Math.max(0, Math.min(1, (o.life || 0) / (o.maxLife || 8)));
    ctx.strokeStyle = 'rgba(87,244,255,0.25)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 24, 8, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(87,244,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 24, 8, 0, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    ctx.stroke();
    const P = mkP(ctx, ox, oy, s, 0, '#eaffff');
    // floating hologram label
    const holo = 0.4 + Math.sin(t * 3) * 0.12;
    P(2, -4, 10, 2, 'rgba(87,244,255,0.12)');
    P(3, -4, 8, 1, 'rgba(87,244,255,' + holo + ')');
    P(4, -3, 1, 1, '#eaffff');
    P(6, -3, 4, 1, '#57f4ff');
    const metal = '#2b3a50', metalHi = '#4a6480', dark = '#0b121c', cyan = '#57f4ff';
    // base / little wheels
    P(3, 14, 8, 2, '#101925');
    P(2, 12, 10, 3, metal);
    P(3, 12, 8, 1, metalHi);
    // keyboard deck
    P(2, 10, 10, 2, metal);
    P(3, 10, 8, 1, '#6b829c');
    // screen bezel
    P(3, 4, 8, 6, dark);
    P(4, 5, 6, 4, '#123a46');
    // code lines on screen
    P(5, 6, 3, 1, cyan);
    P(5, 8, 4, 1, '#8cffb0');
    P(9, 6, 1, 1, '#ffd24a');
    P(9, 8, 1, 1, '#ff3d5e');
    // screen glow
    P(4, 4, 6, 1, metalHi);
    // antenna
    P(10, 2, 1, 2, metalHi);
    P(10, 1, 1, 1, '#ff3d5e');
    P(10, -2, 1, 3, metalHi);
    P(10, -3, 1, 1, Math.floor(t * 3) % 2 ? '#ff3d5e' : '#57f4ff');
    // side emitter
    P(11, 7, 2, 2, dark);
    P(12, 7, 1, 1, cyan);
    // little hands / stabilizers
    P(1, 11, 1, 3, metal);
    P(12, 11, 1, 3, metal);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    U.glow(ctx, x, y - 34, 36, cyan, 0.18 + (o.beamT ? 0.1 : 0));
    U.glow(ctx, x, y - 1, 26, cyan, 0.08);
    U.glow(ctx, x, y - 62, 20, cyan, 0.1);
    ctx.restore();
    if (o.beamT) {
      ctx.fillStyle = 'rgba(200,255,255,0.8)';
      ctx.fillRect(x + 20, y - 36 + bob, 8, 2);
    }
    ctx.restore();
  };

  S.drawPickup = function (ctx, kind, x, y, t) {
    const bob = Math.sin(t * 4 + x * 0.1) * 2;
    y += bob;
    if (kind === 'xp') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      U.glow(ctx, x, y, 13, '#57f4ff', 0.35);
      ctx.restore();
      ctx.fillStyle = '#0c3340';
      ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.fillStyle = '#57f4ff';
      ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.fillStyle = '#e8ffff';
      ctx.fillRect(x - 1, y - 2, 2, 4);
      ctx.fillStyle = '#0c3340';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    } else if (kind === 'coin') {
      const w = Math.max(2, Math.abs(Math.cos(t * 4 + x * 0.05)) * 7);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      U.glow(ctx, x, y, 12, '#ffd24a', 0.3);
      ctx.restore();
      ctx.fillStyle = '#a06a00';
      ctx.beginPath();
      ctx.ellipse(x, y, w, 7, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(1, w - 1.5), 5.5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff6cf';
      ctx.fillRect(x - w * 0.35, y - 3, Math.max(1, w * 0.2), 6);
    } else if (kind === 'heart') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      U.glow(ctx, x, y, 16, '#ff3d5e', 0.35);
      ctx.restore();
      const p = 2;
      const ox = x - 8, oy = y - 8;
      const P = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + a * p, oy + b * p, w * p, h * p); };
      P(1, 0, 2, 1, '#ff3d5e'); P(5, 0, 2, 1, '#ff3d5e');
      P(0, 1, 8, 3, '#ff3d5e');
      P(1, 4, 6, 2, '#e3244a');
      P(2, 6, 4, 1, '#e3244a');
      P(3, 7, 2, 1, '#b01735');
      P(2, 1, 1, 1, '#ffc0c8');
    } else if (kind === 'shield') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      U.glow(ctx, x, y, 16, '#57f4ff', 0.35);
      ctx.restore();
      ctx.fillStyle = '#0c3a48';
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 7, y - 4);
      ctx.lineTo(x + 6, y + 4);
      ctx.lineTo(x, y + 8);
      ctx.lineTo(x - 6, y + 4);
      ctx.lineTo(x - 7, y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#57f4ff';
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 5, y - 3);
      ctx.lineTo(x + 4, y + 3);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 4, y + 3);
      ctx.lineTo(x - 5, y - 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#eaffff';
      ctx.fillRect(x - 1, y - 3, 2, 6);
    } else if (kind === 'magnet') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      U.glow(ctx, x, y, 14, '#b388ff', 0.35);
      ctx.restore();
      ctx.fillStyle = '#3a2b66';
      ctx.fillRect(x - 7, y - 7, 4, 10);
      ctx.fillRect(x + 3, y - 7, 4, 10);
      ctx.fillRect(x - 7, y + 1, 14, 5);
      ctx.fillStyle = '#b388ff';
      ctx.fillRect(x - 5, y - 5, 2, 7);
      ctx.fillRect(x + 3, y - 5, 2, 7);
      ctx.fillRect(x - 5, y + 3, 10, 2);
    } else if (kind === 'key') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      U.glow(ctx, x, y, 16, '#ffd24a', 0.35);
      ctx.restore();
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(x - 6, y - 6, 5, 5);
      ctx.fillStyle = '#0a0e18';
      ctx.fillRect(x - 5, y - 5, 3, 3);
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(x - 1, y - 1, 2, 7);
      ctx.fillRect(x + 1, y + 3, 3, 2);
      ctx.fillRect(x + 1, y + 6, 2, 2);
    }
  };

  // ============================================================
  // WEAPON / RELIC / UPGRADE ICONS
  // ============================================================
  const ICONS = {
    damage: [
      '......##.',
      '.....##..',
      '....##...',
      '...##....',
      '..##.....',
      '.##......',
      '##+##....',
      '...#.....',
      '...#.....'
    ],
    rate: [
      '...###...',
      '..###....',
      '.###.....',
      '#####....',
      '...###...',
      '..###....',
      '.###.....',
      '##.......',
      '.........'
    ],
    speed: [
      '.........',
      '..###....',
      '..###....',
      '..###....',
      '..####...',
      '..#####..',
      '.######..',
      '.#######.',
      '.........'
    ],
    hp: [
      '.........',
      '.##.##...',
      '#######..',
      '#######..',
      '.#####...',
      '..###....',
      '...#.....',
      '.........',
      '.........'
    ],
    crit: [
      '....#....',
      '....#....',
      '..#...#..',
      '...#.#...',
      '##.....##',
      '...#.#...',
      '..#...#..',
      '....#....',
      '....#....'
    ],
    shield: [
      '.#######.',
      '#########',
      '###...###',
      '###...###',
      '#########',
      '.#######.',
      '..#####..',
      '...###...',
      '....#....'
    ],
    multi: [
      '.#..#..#.',
      '##.##.##.',
      '.#..#..#.',
      '.#..#..#.',
      '.#..#..#.',
      '.........',
      '.........',
      '.........',
      '.........'
    ],
    pierce: [
      '.........',
      '..#......',
      '..##.....',
      '.#######.',
      '..##.....',
      '..#......',
      '.........',
      '.........',
      '.........'
    ],
    explode: [
      '.....##..',
      '....#....',
      '...###...',
      '..#####..',
      '.#####+..',
      '.#####+..',
      '..###....',
      '...#.....',
      '.........'
    ],
    magnet: [
      '.##...##.',
      '.##...##.',
      '.##...##.',
      '.##...##.',
      '.#######.',
      '.#######.',
      '..#####..',
      '.........',
      '.........'
    ],
    xp: [
      '.##...##.',
      '.#.....#.',
      '...###...',
      '..#...#..',
      '..#...#..',
      '...###...',
      '.#.....#.',
      '.##...##.',
      '.........'
    ],
    dash: [
      '.....##..',
      '...####..',
      '..#####..',
      '.######..',
      '..#####..',
      '...###...',
      '....#....',
      '.........',
      '.........'
    ],
    skill: [
      '....#....',
      '...#.#...',
      '..##.##..',
      '#########',
      '..##.##..',
      '...#.#...',
      '....#....',
      '.........',
      '.........'
    ],
    heal: [
      '....#....',
      '....#....',
      '....#....',
      '#########',
      '#########',
      '....#....',
      '....#....',
      '....#....',
      '.........'
    ],
    gold: [
      '..#####..',
      '.#######.',
      '##.###.##',
      '##.###.##',
      '.#######.',
      '..#####..',
      '.........',
      '.........',
      '.........'
    ],
    luck: [
      '.###.###.',
      '.#######.',
      '..#####..',
      '...###...',
      '..#####..',
      '.#######.',
      '.###.###.',
      '.........',
      '.........'
    ],
    coffee: [
      '...###...',
      '..#####..',
      '.#######.',
      '.#######.',
      '..#####..',
      '..#####..',
      '...###...',
      '.........',
      '.........'
    ],
    clock: [
      '..#####..',
      '.#.....#.',
      '#...#...#',
      '#..#....#',
      '#.......#',
      '#....#..#',
      '.#.....#.',
      '..#####..',
      '.........'
    ],
    paper: [
      '#########',
      '#.#####.#',
      '#.#...#.#',
      '#.#####.#',
      '#.......#',
      '#.#####.#',
      '#.#...#.#',
      '#.#####.#',
      '#########'
    ],
    deadline: [
      '......##.',
      '.....##..',
      '....##...',
      '...##....',
      '..##.....',
      '.##......',
      '##+......',
      '.........',
      '.........'
    ],
    hotfix: [
      '.#######.',
      '#.......#',
      '#.#####.#',
      '#.#+++#.#',
      '#.#####.#',
      '#.......#',
      '.#######.',
      '..#####..',
      '...###...'
    ],
    gaze: [
      '.........',
      '..#####..',
      '.#.....#.',
      '#..###..#',
      '#.#####.#',
      '#..###..#',
      '.#.....#.',
      '..#####..',
      '.........'
    ],
    enter: [
      '.........',
      '.....####',
      '........#',
      '..#####.#',
      '..#.....#',
      '..#.....#',
      '..#.....#',
      '.........',
      '.........'
    ],
    crown: [
      '#...#...#',
      '##..##..#',
      '##.####.#',
      '#########',
      '##.###.##',
      '##.###.##',
      '.........',
      '.........',
      '.........'
    ],
    star: [
      '....#....',
      '...###...',
      '#########',
      '.#######.',
      '..#####..',
      '.##...##.',
      '#.......#',
      '.........',
      '.........'
    ],
    heart: [
      '.##...##.',
      '####.####',
      '#########',
      '#########',
      '.#######.',
      '..#####..',
      '...###...',
      '....#....',
      '.........'
    ],
  };
  S.ICONS = ICONS;

  S.drawIcon = function (ctx, name, x, y, size, color, accent) {
    const rows = ICONS[name] || ICONS.star;
    const cell = size / 9;
    const c = color || '#57f4ff';
    const a = accent || '#ffffff';
    for (let r = 0; r < 9; r++) {
      const row = rows[r];
      for (let q = 0; q < 9; q++) {
        const ch = row[q];
        if (ch === '.') continue;
        ctx.fillStyle = ch === '+' ? a : c;
        ctx.fillRect(Math.round(x + q * cell), Math.round(y + r * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
  };

  S.drawWeaponIcon = function (ctx, kind, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    const u = size / 32;
    const aura = kind === 'laser' ? 'rgba(125,255,168,0.14)' : kind === 'stapler' ? 'rgba(255,210,74,0.12)' : 'rgba(87,244,255,0.12)';
    const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.7);
    bg.addColorStop(0, aura);
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(-size, -size, size * 2, size * 2);
    if (kind === 'keyboard') {
      ctx.fillStyle = '#0a1220';
      ctx.fillRect(-17 * u, -12 * u, 34 * u, 26 * u);
      ctx.fillStyle = '#26374f';
      ctx.fillRect(-15 * u, -10 * u, 30 * u, 20 * u);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 7; c++) {
          ctx.fillStyle = (r + c) % 5 === 0 ? '#57f4ff' : '#8fa4c0';
          ctx.fillRect((-13 + c * 3.9) * u, (-8 + r * 4.2) * u, 2.9 * u, 2.9 * u);
        }
      }
      ctx.fillStyle = '#57f4ff';
      ctx.fillRect(-7 * u, 6 * u, 14 * u, 2.6 * u);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-15 * u, -10 * u, 30 * u, 1 * u);
    } else if (kind === 'stapler') {
      ctx.fillStyle = '#0a1220';
      ctx.fillRect(-17 * u, -10 * u, 34 * u, 9 * u);
      ctx.fillStyle = '#3a4660';
      ctx.fillRect(-15 * u, -8 * u, 28 * u, 4 * u);
      ctx.fillStyle = '#7a8aa8';
      ctx.fillRect(-16 * u, -1 * u, 32 * u, 8 * u);
      ctx.fillStyle = '#26324a';
      ctx.fillRect(-16 * u, 5 * u, 32 * u, 2.5 * u);
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(12 * u, -3 * u, 9 * u, 3 * u);
      ctx.fillStyle = '#111a2b';
      ctx.fillRect(13 * u, -11 * u, 8 * u, 5 * u);
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(15 * u, -10 * u, 4 * u, 1.6 * u);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(-15 * u, -8 * u, 28 * u, 1 * u);
    } else {
      ctx.fillStyle = '#0a1220';
      ctx.fillRect(-18 * u, -6 * u, 27 * u, 12 * u);
      ctx.fillStyle = '#2c3a52';
      ctx.fillRect(-16 * u, -4 * u, 23 * u, 6 * u);
      ctx.fillStyle = '#1a2436';
      ctx.fillRect(-16 * u, 6 * u, 7 * u, 9 * u);
      ctx.fillStyle = '#3a4a62';
      ctx.fillRect(-15 * u, 7 * u, 5 * u, 2 * u);
      ctx.fillStyle = '#7dffa8';
      ctx.fillRect(9 * u, -3 * u, 11 * u, 4 * u);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(125,255,168,0.9)';
      ctx.fillRect(18 * u, -1.5 * u, 13 * u, 2 * u);
      U.glow(ctx, 20 * u, 0, 11 * u, '#7dffa8', 0.4);
      ctx.restore();
    }
    ctx.restore();
  };

  // ============================================================
  // OBSTACLES / FURNITURE
  // ============================================================
  S.drawObstacle = function (ctx, ob, t) {
    const o = ob;
    switch (o.type) {
      case 'desk': drawDesk(ctx, o, t); break;
      case 'partition': drawPartition(ctx, o, t); break;
      case 'plant': drawPlant(ctx, o, t); break;
      case 'sofa': drawSofa(ctx, o, t); break;
      case 'cooler': drawCooler(ctx, o, t); break;
      case 'table': drawTable(ctx, o, t); break;
      case 'copier': drawCopier(ctx, o, t); break;
      case 'cabinet': drawCabinet(ctx, o, t); break;
      case 'vending': drawVending(ctx, o, t); break;
      case 'chest': drawChest(ctx, o, t); break;
      case 'server': drawServer(ctx, o, t); break;
      case 'fridge': drawFridge(ctx, o, t); break;
      case 'whiteboard': drawWhiteboard(ctx, o, t); break;
      case 'boxes': drawBoxes(ctx, o, t); break;
      case 'bossdesk': drawBossDesk(ctx, o, t); break;
    }
  };

  function furnitureBase(ctx, o, colTop, colFront, colEdge) {
    const { x, y, w, h } = o;
    // soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 4, w * 0.52, 7, 0, 0, TAU);
    ctx.fill();
    // front face
    ctx.fillStyle = colFront;
    ctx.fillRect(x + 2, y + h * 0.55, w - 4, h * 0.45 + 6);
    // top
    ctx.fillStyle = colTop;
    ctx.fillRect(x, y, w, h * 0.62);
    ctx.fillStyle = colEdge;
    ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y + 2, w, 2);
  }

  function drawDesk(ctx, o, t) {
    const { x, y, w, h } = o;
    furnitureBase(ctx, o, o.top || '#3b4a63', o.front || '#1d2738', o.edge || '#5c7190');
    // monitor pushed to the back
    const mw = Math.min(40, w * 0.34);
    const mx = x + w * 0.5 - mw / 2 + (o.seed % 2 ? -w * 0.16 : w * 0.16);
    const my = y - 24;
    ctx.fillStyle = '#0a0f19';
    ctx.fillRect(mx - 3, my, mw + 6, 22);
    ctx.fillStyle = '#101a28';
    ctx.fillRect(mx, my + 2, mw, 18);
    const g = ctx.createLinearGradient(mx, my, mx, my + 18);
    g.addColorStop(0, 'rgba(87,244,255,0.35)');
    g.addColorStop(1, 'rgba(87,244,255,0.06)');
    ctx.fillStyle = g;
    ctx.fillRect(mx + 2, my + 4, mw - 4, 14);
    ctx.fillStyle = 'rgba(200,255,255,0.55)';
    const lines = 3 + (o.seed % 3);
    for (let i = 0; i < lines; i++) {
      ctx.fillRect(mx + 4, my + 5 + i * 3.4, (mw - 12) * (0.3 + U.noise1(o.seed + i) * 0.6), 1);
    }
    ctx.fillStyle = '#26364d';
    ctx.fillRect(mx + mw * 0.4, my + 20, mw * 0.2, 3);
    // keyboard
    ctx.fillStyle = '#16202f';
    ctx.fillRect(x + w * 0.5 - 12, y + h * 0.6, 24, 8);
    ctx.fillStyle = '#31445c';
    for (let i = 0; i < 6; i++) ctx.fillRect(x + w * 0.5 - 10 + i * 3.4, y + h * 0.6 + 2, 2, 1.5);
    // papers & cup
    ctx.fillStyle = '#d8d3c2';
    ctx.fillRect(x + 8, y + h * 0.3, 11, 7);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(x + w - 18, y + 6, 8, 9);
    ctx.fillStyle = '#7a5410';
    ctx.fillRect(x + w - 18, y + 10, 8, 1);
    ctx.fillStyle = '#57f4ff';
    ctx.fillRect(x + w - 15, y + 3, 2, 3);
    // chair
    if (o.chair !== false) {
      const cx = x + w * 0.5, cy = y + h + 10;
      ctx.fillStyle = '#151c29';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6, 16, 6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#26324a';
      ctx.fillRect(cx - 14, cy - 2, 28, 8);
      ctx.fillStyle = '#33425e';
      ctx.fillRect(cx - 12, cy - 1, 24, 3);
      ctx.fillRect(cx - 1, cy + 4, 2, 10);
    }
  }

  function drawPartition(ctx, o, t) {
    const { x, y, w, h } = o;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 3, w * 0.54, 6, 0, 0, TAU);
    ctx.fill();
    // frame
    ctx.fillStyle = '#28364b';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#1a2434';
    ctx.fillRect(x, y, w, 4);
    // glass
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(90,180,210,0.28)');
    g.addColorStop(0.5, 'rgba(60,120,150,0.14)');
    g.addColorStop(1, 'rgba(120,210,240,0.24)');
    ctx.fillStyle = g;
    ctx.fillRect(x + 3, y + 5, w - 6, h - 9);
    // reflections
    ctx.fillStyle = 'rgba(220,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(x + 8, y + h - 6);
    ctx.lineTo(x + w * 0.42, y + 6);
    ctx.lineTo(x + w * 0.55, y + 6);
    ctx.lineTo(x + 20, y + h - 6);
    ctx.closePath();
    ctx.fill();
    // posts
    ctx.fillStyle = '#2f4057';
    ctx.fillRect(x + 2, y + h - 5, 3, 7);
    ctx.fillRect(x + w - 5, y + h - 5, 3, 7);
    // sticky notes
    const cols = ['#ffd24a', '#ff6f91', '#7dffa8'];
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = cols[(o.seed + i) % cols.length];
      ctx.fillRect(x + 7 + i * 14, y + 10 + (i % 2) * 6, 8, 8);
    }
  }

  function drawPlant(ctx, o, t) {
    const { x, y, w, h } = o;
    const cx = x + w / 2, base = y + h;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(cx, base + 2, w * 0.6, 5, 0, 0, TAU); ctx.fill();
    // pot
    ctx.fillStyle = '#7a4a33';
    ctx.beginPath();
    ctx.moveTo(cx - 12, base - 18);
    ctx.lineTo(cx + 12, base - 18);
    ctx.lineTo(cx + 9, base);
    ctx.lineTo(cx - 9, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a3654a';
    ctx.fillRect(cx - 13, base - 20, 26, 4);
    ctx.fillStyle = '#5a3525';
    ctx.fillRect(cx - 10, base - 14, 20, 3);
    // leaves
    const sway = Math.sin(t * 1.4 + o.seed) * 2;
    const leaves = [
      [-14, -34, -8, -52, '#1f7a56'],
      [-2, -36, 2 + sway, -60, '#2a9d68'],
      [10, -32, 18 + sway, -48, '#1f7a56'],
      [-8, -28, -20 + sway, -38, '#37b878'],
      [6, -26, 16, -34, '#37b878'],
      [0, -38, -3, -56, '#3ddb8f'],
    ];
    for (const [x1, y1, x2, y2, col] of leaves) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + x1 * 0.55, base - 18 + y1 * 0.2);
      ctx.quadraticCurveTo(cx + x1, base + y1, cx + x2, base + y2);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  function drawSofa(ctx, o, t) {
    const { x, y, w, h } = o;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 4, w * 0.52, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2c44';
    ctx.fillRect(x, y - 14, w, h + 14);
    ctx.fillStyle = '#543e63';
    ctx.fillRect(x + 4, y - 10, w - 8, h + 6);
    // cushions
    ctx.fillStyle = '#6a4d7d';
    ctx.fillRect(x + 7, y - 6, w * 0.44, h - 4);
    ctx.fillRect(x + w * 0.5, y - 6, w * 0.44, h - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 9, y - 4, w * 0.4, 3);
    ctx.fillRect(x + w * 0.52, y - 4, w * 0.4, 3);
    // armrests
    ctx.fillStyle = '#2c2034';
    ctx.fillRect(x - 2, y - 12, 8, h + 14);
    ctx.fillRect(x + w - 6, y - 12, 8, h + 14);
    // coffee stain
    ctx.fillStyle = 'rgba(90,55,35,0.35)';
    ctx.beginPath(); ctx.ellipse(x + w * 0.7, y + h + 2, 9, 3, 0, 0, TAU); ctx.fill();
  }

  function drawCooler(ctx, o, t) {
    const { x, y, w, h } = o;
    const cx = x + w / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(cx, y + h + 2, w * 0.6, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c9d6df';
    ctx.fillRect(x, y + 12, w, h + 6);
    ctx.fillStyle = '#eef4f8';
    ctx.fillRect(x + 3, y + 14, w - 6, h);
    ctx.fillStyle = '#8fa4b5';
    ctx.fillRect(x + 3, y + h + 2, w - 6, 4);
    // bottle
    ctx.fillStyle = '#57b8d6';
    ctx.beginPath();
    ctx.ellipse(cx, y + 6, w * 0.34, 12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(230,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(cx - 4, y + 1, 3, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#dfe9f0';
    ctx.fillRect(cx - 4, y + 16, 8, 6);
    // taps
    ctx.fillStyle = '#3a4a5c';
    ctx.fillRect(cx - 4, y + 26, 3, 4);
    ctx.fillRect(cx + 2, y + 26, 3, 4);
    ctx.fillStyle = '#e05a4a';
    ctx.fillRect(cx - 4, y + 25, 3, 2);
    ctx.fillStyle = '#4a8ad0';
    ctx.fillRect(cx + 2, y + 25, 3, 2);
  }

  function drawTable(ctx, o, t) {
    const { x, y, w, h } = o;
    const top = o.top || '#26344a';
    const topHi = o.edge || '#5c7190';
    const chair = U.mix(top, '#000000', 0.45);
    const chairHi = U.mix(top, '#ffffff', 0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 4, w * 0.54, 8, 0, 0, TAU); ctx.fill();
    // chairs
    for (const cx of [x + w * 0.2, x + w * 0.8]) {
      ctx.fillStyle = chair;
      ctx.beginPath(); ctx.ellipse(cx, y + h + 16, 13, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = chairHi;
      ctx.fillRect(cx - 11, y + h + 8, 22, 7);
    }
    // table top
    ctx.fillStyle = chair;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2 + 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2 - 2, w / 2 - 3, h / 2, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = U.rgba(topHi, 0.28);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2 - 2, w / 2 - 12, h / 2 - 6, 0, 0, TAU);
    ctx.stroke();
    // papers, cups, laptop
    ctx.fillStyle = '#ded8c4';
    ctx.fillRect(x + w * 0.3, y + h * 0.4, 18, 11);
    ctx.fillStyle = '#f2eddc';
    ctx.fillRect(x + w * 0.3 + 2, y + h * 0.4 + 2, 14, 7);
    ctx.fillStyle = '#e05a4a';
    ctx.fillRect(x + w * 0.68, y + h * 0.36, 6, 6);
    ctx.fillStyle = '#16202f';
    ctx.fillRect(x + w * 0.55, y + h * 0.55, 22, 12);
    ctx.fillStyle = '#57f4ff';
    ctx.fillRect(x + w * 0.55 + 2, y + h * 0.55 + 2, 18, 7);
    ctx.fillStyle = '#0a1220';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + w * 0.55 + 4, y + h * 0.55 + 4 + i * 2, 13, 1);
  }

  function drawCopier(ctx, o, t) {
    const { x, y, w, h } = o;
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 3, w * 0.56, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a3346';
    ctx.fillRect(x, y + 8, w, h);
    ctx.fillStyle = '#3c4a63';
    ctx.fillRect(x + 2, y + 4, w - 4, 8);
    ctx.fillStyle = '#212a3b';
    ctx.fillRect(x + 4, y + 13, w - 8, 8);
    ctx.fillStyle = '#0c111b';
    ctx.fillRect(x + 6, y + 14, w - 12, 5);
    // paper output
    ctx.fillStyle = '#e9e4d2';
    ctx.fillRect(x + 5, y + 2, w - 10, 3);
    // tray
    ctx.fillStyle = '#1b2230';
    ctx.fillRect(x + 3, y + h - 10, w - 6, 7);
    ctx.fillStyle = '#e9e4d2';
    ctx.fillRect(x + 6, y + h - 9, w - 12, 3);
    // indicator
    const blink = Math.sin(t * 5 + o.seed) > 0 ? '#ff3d5e' : '#5a1520';
    ctx.fillStyle = blink;
    ctx.fillRect(x + w - 9, y + 17, 3, 2);
    ctx.fillStyle = '#57f4ff';
    ctx.fillRect(x + 5, y + 17, 8, 2);
  }

  function drawCabinet(ctx, o, t) {
    const { x, y, w, h } = o;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 3, w * 0.58, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2b3445';
    ctx.fillRect(x, y - 10, w, h + 10);
    ctx.fillStyle = '#3c4a61';
    ctx.fillRect(x + 3, y - 7, w - 6, h + 4);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#4d5f7a';
      ctx.fillRect(x + 5, y - 4 + i * 12, w - 10, 10);
      ctx.fillStyle = '#222b3a';
      ctx.fillRect(x + w / 2 - 5, y + 1 + i * 12, 10, 2);
    }
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(x + 4, y - 6, 5, 2);
  }

  function drawVending(ctx, o, t) {
    const { x, y, w, h } = o;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 3, w * 0.58, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b2332';
    ctx.fillRect(x, y - 20, w, h + 20);
    ctx.fillStyle = '#2b3a50';
    ctx.fillRect(x + 3, y - 17, w - 6, h + 14);
    // window
    ctx.fillStyle = '#0b1420';
    ctx.fillRect(x + 6, y - 12, w - 12, h * 0.55);
    const g = ctx.createLinearGradient(x, y, x, y + h * 0.6);
    g.addColorStop(0, 'rgba(57,244,255,0.25)');
    g.addColorStop(1, 'rgba(57,244,255,0.02)');
    ctx.fillStyle = g;
    ctx.fillRect(x + 6, y - 12, w - 12, h * 0.55);
    // snacks
    const cols = ['#ff3d5e', '#ffd24a', '#57f4ff', '#a6ff5e'];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = cols[(r * 3 + c + o.seed) % cols.length];
        ctx.fillRect(x + 10 + c * 12, y - 7 + r * 12, 7, 8);
      }
    }
    // glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    U.glow(ctx, x + w / 2, y + 16, w * 0.9, '#57f4ff', 0.12);
    ctx.restore();
    // bottom slot
    ctx.fillStyle = '#0a0f18';
    ctx.fillRect(x + 8, y + h - 18, w - 16, 10);
    ctx.fillStyle = '#57f4ff';
    ctx.fillRect(x + 10, y + h - 8, 12, 2);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(x + w - 16, y + h - 8, 6, 2);
  }

  function drawChest(ctx, o, t) {
    const { x, y, w, h } = o;
    const cx = x + w / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(cx, y + h + 3, w * 0.6, 6, 0, 0, TAU); ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    U.glow(ctx, cx, y + h / 2, 34, '#ffd24a', 0.16 + Math.sin(t * 3) * 0.05);
    ctx.restore();
    // body
    ctx.fillStyle = '#6b4718';
    ctx.fillRect(x + 2, y + 10, w - 4, h - 8);
    ctx.fillStyle = '#a87328';
    ctx.fillRect(x + 4, y + 13, w - 8, h - 13);
    ctx.fillStyle = '#d9a13a';
    ctx.fillRect(x + 4, y + 13, w - 8, 3);
    // lid
    ctx.fillStyle = '#8f5f20';
    ctx.fillRect(x, y + 2, w, 11);
    ctx.fillStyle = '#c78f32';
    ctx.fillRect(x + 2, y + 4, w - 4, 7);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(x + 2, y + 10, w - 4, 2);
    // straps
    ctx.fillStyle = '#4a2e0e';
    ctx.fillRect(x + w * 0.28, y + 2, 4, h - 2);
    ctx.fillRect(x + w * 0.68, y + 2, 4, h - 2);
    // lock
    const open = o.opened;
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(cx - 5, y + 13, 10, 9);
    ctx.fillStyle = '#6b4718';
    ctx.fillRect(cx - 2, y + 16, 4, 4);
    if (open) {
      ctx.fillStyle = 'rgba(255,220,120,0.9)';
      ctx.fillRect(x + 2, y - 8 + Math.sin(t * 3) * 2, w - 4, 3);
    }
  }

  function drawServer(ctx, o, t) {
    const { x, y, w, h } = o;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 3, w * 0.58, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#141b28';
    ctx.fillRect(x, y - 16, w, h + 16);
    ctx.fillStyle = '#202b3d';
    ctx.fillRect(x + 2, y - 14, w - 4, h + 12);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = '#2f3d53';
      ctx.fillRect(x + 4, y - 12 + i * 9, w - 8, 7);
      ctx.fillStyle = '#0d131d';
      ctx.fillRect(x + 5, y - 11 + i * 9, w - 10, 5);
      const on = U.noise1(o.seed + i + Math.floor(t * 3)) > 0.55;
      ctx.fillStyle = on ? '#57f4ff' : '#1b4a56';
      ctx.fillRect(x + 7, y - 9 + i * 9, 2, 2);
      ctx.fillStyle = U.noise1(o.seed + i * 3 + Math.floor(t * 2)) > 0.8 ? '#ff3d5e' : '#4a1820';
      ctx.fillRect(x + 11, y - 9 + i * 9, 2, 2);
    }
  }

  function drawFridge(ctx, o, t) {
    const { x, y, w, h } = o;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 3, w * 0.6, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#aab7c4';
    ctx.fillRect(x, y - 20, w, h + 20);
    ctx.fillStyle = '#d6e1e9';
    ctx.fillRect(x + 3, y - 17, w - 6, h + 14);
    ctx.fillStyle = '#8c9ba9';
    ctx.fillRect(x + 3, y + h * 0.35, w - 6, 2);
    ctx.fillStyle = '#5c6b79';
    ctx.fillRect(x + w - 10, y + h * 0.12, 3, 14);
    ctx.fillRect(x + w - 10, y + h * 0.5, 3, 16);
    ctx.fillStyle = '#ff3d5e';
    ctx.fillRect(x + 7, y - 8, 6, 6);
    ctx.fillStyle = '#e9e4d2';
    ctx.fillRect(x + 16, y - 10, 10, 12);
  }

  function drawWhiteboard(ctx, o, t) {
    const { x, y, w, h } = o;
    ctx.fillStyle = '#768a9e';
    ctx.fillRect(x, y - 5, w, h + 8);
    ctx.fillStyle = '#e9eef2';
    ctx.fillRect(x + 4, y - 1, w - 8, h);
    ctx.strokeStyle = '#46596c';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y - 1, w - 8, h);
    // scribbles
    ctx.strokeStyle = '#3a7bd5';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + h * 0.72);
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(x + 10 + i * (w - 24) / 5, y + h * (0.3 + U.noise1(o.seed + i) * 0.5));
    }
    ctx.stroke();
    ctx.strokeStyle = '#e05a4a';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + h * 0.4);
    ctx.lineTo(x + w - 14, y + h * 0.35);
    ctx.stroke();
    ctx.fillStyle = '#e05a4a';
    ctx.font = 'bold 10px Consolas';
    ctx.fillText('KPI!', x + w - 40, y + h * 0.26);
  }

  function drawBoxes(ctx, o, t) {
    const { x, y, w, h } = o;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 3, w * 0.6, 6, 0, 0, TAU); ctx.fill();
    const cols = ['#b08a5a', '#8f6c43', '#c9a06a'];
    const n = 3;
    for (let i = 0; i < n; i++) {
      const bw = w * (0.6 + (i % 2) * 0.2);
      const bh = h * 0.46;
      const bx = x + (i % 2 ? w * 0.18 : 9) + i * 3;
      const by = y + h - bh * (i + 1) * 0.7;
      ctx.fillStyle = cols[(i + o.seed) % cols.length];
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(bx, by + bh - 3, bw, 3);
      ctx.fillStyle = '#e9e4d2';
      ctx.fillRect(bx + bw * 0.3, by + 4, bw * 0.4, 6);
      ctx.fillStyle = 'rgba(60,40,20,0.5)';
      ctx.fillRect(bx + bw * 0.35, by + 6, bw * 0.3, 1);
      ctx.fillRect(bx + bw * 0.35, by + 8, bw * 0.2, 1);
    }
  }

  function drawBossDesk(ctx, o, t) {
    const { x, y, w, h } = o;
    furnitureBase(ctx, o, '#3a2c2a', '#211713', '#6b4a3a');
    // gold edge
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(x, y + h * 0.55, w, 2);
    // nameplate
    ctx.fillStyle = '#0d0a0c';
    ctx.fillRect(x + w * 0.42, y + h * 0.2, w * 0.16, h * 0.22);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(x + w * 0.43, y + h * 0.21, w * 0.14, 2);
    // monitor (blood red)
    const mw = 56;
    ctx.fillStyle = '#0a080c';
    ctx.fillRect(x + w / 2 - mw / 2, y - 34, mw, 32);
    ctx.fillStyle = '#1a0a10';
    ctx.fillRect(x + w / 2 - mw / 2 + 3, y - 31, mw - 6, 26);
    ctx.fillStyle = 'rgba(255,61,94,0.5)';
    ctx.fillRect(x + w / 2 - mw / 2 + 5, y - 29, mw - 10, 22);
    ctx.fillStyle = '#ff3d5e';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + w / 2 - mw / 2 + 7, y - 26 + i * 5, (mw - 18) * (0.3 + U.noise1(o.seed + i) * 0.6), 2);
    // drink
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(x + w - 30, y + 8, 12, 16);
    ctx.fillStyle = '#7a5410';
    ctx.fillRect(x + w - 30, y + 16, 12, 2);
    // chair
    ctx.fillStyle = '#120d10';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 20, 34, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1d22';
    ctx.fillRect(x + w / 2 - 26, y + h + 2, 52, 14);
  }

  // ============================================================
  // PORTRAIT
  // ============================================================
  S.fullImages = {};
  S.playerSprites = {};
  S.playerWhites = {};
  S.playerFrames = { abigail: {}, ama: {} };
  S.loadAssets = function (done) {
    let pending = 9;
    let finished = false;
    const once = () => {
      if (finished) return;
      finished = true;
      S.ready = true;
      if (done) done();
    };
    const finish = () => { if (--pending <= 0) once(); };
    const load = (src, cb) => {
      const im = new Image();
      im.onload = () => { cb(im); finish(); };
      im.onerror = () => { finish(); };
      im.src = src;
    };
    load('assets/abigail_full.webp', (im) => { S.fullImages.abigail = im; });
    load('assets/ama_full.webp', (im) => { S.fullImages.ama = im; });
    load('assets/abigail_avatar.jpg', (im) => { S.imgAbigail = im; });
    const loadSprite = (id, src) => load(src, (im) => {
      S.playerSprites[id] = im;
      S.playerFrames[id].idle = im;
      const cv = U.makeCanvas(im.width, im.height);
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(im, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, cv.width, cv.height);
      S.playerWhites[id] = cv;
    });
    const loadFrame = (id, key, src) => load(src, (im) => { S.playerFrames[id][key] = im; });
    loadSprite('abigail', 'assets/abigail_sprite.png');
    loadSprite('ama', 'assets/ama_sprite.png');
    loadFrame('abigail', 'walk', 'assets/abigail_walk.png');
    loadFrame('abigail', 'attack', 'assets/abigail_attack.png');
    loadFrame('ama', 'walk', 'assets/ama_walk.png');
    loadFrame('ama', 'attack', 'assets/ama_attack.png');
    setTimeout(() => once(), 2600);
  };

  S.drawPortrait = function (ctx, charId, w, h) {
    ctx.clearRect(0, 0, w, h);
    const full = S.fullImages && S.fullImages[charId];
    if (full && full.complete && full.naturalWidth) {
      // downscale to a 64px grid then nearest-upscale -> keeps the pixel-art feel
      const off = U.makeCanvas(64, 64);
      const oc = off.getContext('2d');
      oc.imageSmoothingEnabled = true;
      const scale = Math.max(64 / full.width, 64 / full.height);
      const dw = full.width * scale, dh = full.height * scale;
      oc.drawImage(full, (64 - dw) / 2, (64 - dh) / 2 - 5, dw, dh);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(40, 20, 70, 0.08)');
      g.addColorStop(1, 'rgba(4, 10, 18, 0.28)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      return;
    }
    const img = S.imgAbigail;
    if (charId !== 'ama' && img && img.complete) {
      const scale = Math.max(w / img.width, h / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      // colour grade: cool rim + scanlines
      ctx.fillStyle = 'rgba(30,10,50,0.12)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      return;
    }
    // procedural Ama portrait
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#12283a');
    g.addColorStop(1, '#070d16');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const u = w / 96;
    const px = (x, y, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(x * u, y * u, ww * u, hh * u); };
    px(20, 78, 56, 18, '#175d76');
    px(28, 64, 40, 18, '#0f3b4c');
    px(32, 66, 32, 6, '#2f9bb4');
    px(24, 34, 48, 38, '#172840');
    px(30, 32, 36, 8, '#345a7c');
    px(30, 38, 36, 28, '#ffd2ae');
    px(32, 44, 32, 6, '#1c354c');
    px(36, 50, 10, 8, '#39f4ff');
    px(56, 50, 10, 8, '#39f4ff');
    px(38, 52, 4, 4, '#ffffff');
    px(58, 52, 4, 4, '#ffffff');
    px(46, 58, 8, 2, '#dca07e');
    px(34, 46, 4, 2, '#2f9bb4');
    px(62, 46, 4, 2, '#2f9bb4');
    px(30, 36, 36, 2, '#0b3a4c');
    px(40, 28, 20, 6, '#0b3a4c');
    px(24, 76, 52, 4, '#57f4ff');
  };

  S.drawPortraitTo = function (canvas, charId) {
    const ctx = canvas.getContext('2d');
    S.drawPortrait(ctx, charId, canvas.width, canvas.height);
  };
})();
