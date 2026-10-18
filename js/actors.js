/* ============================================================
   actors.js — player, bullets, enemies, boss, pickups, shockwaves
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;
  const FX = G.FX;
  const SP = G.Sprites;
  const TAU = Math.PI * 2;

  function canAct(game) {
    if (!game) return false;
    if (game.state !== 'play' && game.state !== 'cleared') return false;
    if (G.UI && G.UI.modalOpen) return false;
    if (typeof game.canAct === 'function' && !game.canAct()) return false;
    return !!game.player && !game.player.dead;
  }

  function combat() {
    if (!G.Combat) throw new Error('js/combat.js must load before js/actors.js');
    return G.Combat;
  }

  function drawMark(ctx, x, y, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    U.glow(ctx, x, y, 18, '#8cffb0', 0.32 + Math.sin(t * 6) * 0.08);
    ctx.strokeStyle = 'rgba(180,255,205,0.95)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 4.6, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#57f4ff';
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#eafff0';
    ctx.fillRect(x - 1, y - 1, 1, 1);
    // little scan ticks
    ctx.strokeStyle = 'rgba(140,255,176,0.45)';
    ctx.beginPath();
    ctx.moveTo(x - 13, y); ctx.lineTo(x - 10, y);
    ctx.moveTo(x + 10, y); ctx.lineTo(x + 13, y);
    ctx.stroke();
    ctx.restore();
  }

  function drawStun(ctx, x, y, t) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * TAU / 3;
      const sx = x + Math.cos(a) * 14;
      const sy = y + Math.sin(a) * 5;
      ctx.fillStyle = i === 0 ? '#ffd24a' : 'rgba(255,210,74,0.7)';
      ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
    }
    ctx.restore();
  }

  // ============================================================
  // PLAYER
  // ============================================================
  class Player {
    constructor(game) {
      const run = game.run;
      this.game = game;
      this.x = game.world.spawn.x;
      this.y = game.world.spawn.y;
      this.r = 13;
      this.aim = 0;
      this.walk = 0;
      this.moving = false;
      this.flip = false;
      this.shootCd = 0;
      this.laserTick = 0;
      this.laserHeat = 0;
      this.laserOverheated = false;
      this.laserHotWarned = false;
      this._laserContacts = new Map();
      this._laserSettleClock = 0;
      this.fireAnim = 0;
      this.dashT = 0;
      this.dashCd = 0;
      this.dashCharge = 1;
      this.dashRecharge = 0;
      this.dashHit = new Set();
      this.dashDir = { x: 1, y: 0 };
      this.dodgeTextCd = 0;
      this.invuln = 1.2;
      this.hitFlash = 0;
      this.skillCd = 0;
      this.skill2Cd = 0;
      this.meleeT = 0;
      this.meleeDur = 0.2;
      this.meleeCd = 0;
      this.meleeCombo = 0;
      this.meleeComboT = 0;
      this.meleeAng = 0;
      this.meleeHit = false;
      this.focus = false;
      this.aimTarget = null;
      this.attackAnimT = 0;
      this.hurtT = 0;
      this.autoNovaT = 0;
      this.touchCd = 0;
      this.slowField = 0;
      this.beam = null;
      this.afterimageT = 0;
      this.introT = 0.6;
      this.walked = 0;
      this.blinkT = 0;
      this.blinkClock = 2.4 + Math.random() * 2.6;
      this.dead = false;
      this.reviveUsed = 0;
      this.aimHeight = SP.playerSprites && SP.playerSprites[run.character] ? 52 : 26;
    }

    get stats() { return this.game.run.stats; }
    get weapon() { return G.DATA.weapons[this.game.run.weapon]; }

    update(dt) {
      const game = this.game;
      const run = game.run;
      const st = run.stats;
      const input = game.input;
      const C = combat();
      input.attackBuffer = Math.max(0, (Number(input.attackBuffer) || 0) - dt);
      this.aimHeight = SP.playerSprites && SP.playerSprites[run.character] ? 52 : 26;
      this.introT = Math.max(0, this.introT - dt);
      this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
      this.invuln = Math.max(0, this.invuln - dt);
      this.blinkClock -= dt;
      if (this.blinkClock <= 0) {
        this.blinkT = 0.13;
        this.blinkClock = 2.6 + Math.random() * 2.8;
      }
      this.blinkT = Math.max(0, this.blinkT - dt);
      const dashMax = st.dashCharges;
      if (this.dashCharge > dashMax) this.dashCharge = dashMax;
      if (this.dashCharge < dashMax) {
        this.dashRecharge -= dt;
        if (this.dashRecharge <= 0) {
          this.dashCharge++;
          this.dashRecharge = this.dashCharge < dashMax ? st.dodgeCd : 0;
        }
      }
      this.dashCd = this.dashCharge > 0 ? 0 : this.dashRecharge;
      this.shootCd = Math.max(0, this.shootCd - dt);
      this.skillCd = Math.max(0, this.skillCd - dt);
      this.skill2Cd = Math.max(0, this.skill2Cd - dt);
      this.meleeCd = Math.max(0, this.meleeCd - dt);
      this.meleeComboT = Math.max(0, this.meleeComboT - dt);
      if (this.meleeComboT <= 0) this.meleeCombo = 0;
      this.attackAnimT = Math.max(0, this.attackAnimT - dt);
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.dodgeTextCd = Math.max(0, this.dodgeTextCd - dt);
      this.updateMelee(dt);
      this.fireAnim = Math.max(0, this.fireAnim - dt * 6);
      this.touchCd = Math.max(0, this.touchCd - dt);

      // Aim, render and collision share this body-space origin.
      this.aimTarget = null;
      const aimOrigin = C.getAimOrigin(this);
      let ax = Number.isFinite(input.aimX) ? input.aimX : aimOrigin.x + Math.cos(this.aim) * 100;
      let ay = Number.isFinite(input.aimY) ? input.aimY : aimOrigin.y + Math.sin(this.aim) * 100;
      if (input.usingTouch) {
        const tgt = game.nearestEnemy(aimOrigin.x, aimOrigin.y, 900);
        if (tgt) {
          const p = C.getTargetPoint(tgt);
          ax = p.x; ay = p.y;
          this.aimTarget = tgt;
        } else {
          ax = aimOrigin.x + Math.cos(this.aim) * 100;
          ay = aimOrigin.y + Math.sin(this.aim) * 100;
        }
      } else if (game.settings.autoAim) {
        const tgt = game.nearestEnemy(aimOrigin.x, aimOrigin.y, 780);
        if (tgt) {
          const p = C.getTargetPoint(tgt);
          const rawAim = Math.atan2(ay - aimOrigin.y, ax - aimOrigin.x);
          const targetAim = Math.atan2(p.y - aimOrigin.y, p.x - aimOrigin.x);
          const diff = Math.abs(Math.atan2(Math.sin(targetAim - rawAim), Math.cos(targetAim - rawAim)));
          const cone = input.mouseMovedRecently ? 0.24 : 0.65;
          if (diff < cone) {
            ax = p.x;
            ay = p.y;
            this.aimTarget = tgt;
          }
        }
      }
      if (ax !== aimOrigin.x || ay !== aimOrigin.y) {
        const target = Math.atan2(ay - aimOrigin.y, ax - aimOrigin.x);
        this.aim = this.weapon.melee && (input.clickFire || input.attackBuffer > 0)
          ? target : U.angleLerp(this.aim, target, Math.min(1, dt * 22));
      }
      this.flip = Math.cos(this.aim) < 0;
      this.focus = !!input.firing;

      // movement
      let mx = 0, my = 0;
      if (input.keys['a'] || input.keys['arrowleft']) mx -= 1;
      if (input.keys['d'] || input.keys['arrowright']) mx += 1;
      if (input.keys['w'] || input.keys['arrowup']) my -= 1;
      if (input.keys['s'] || input.keys['arrowdown']) my += 1;
      if (input.touch.x || input.touch.y) { mx = input.touch.x; my = input.touch.y; }
      const ml = Math.hypot(mx, my);
      if (ml > 1) { mx /= ml; my /= ml; }
      this.moving = ml > 0.05;
      const wasDashing = this.dashT > 0;
      const obstacles = game.world && game.world.obstacles ? game.world.obstacles : [];
      const bounds = game.world && game.world.bounds;

      if (this.dashT > 0) {
        this.dashT -= dt;
        const spd = 920;
        const moved = U.moveCircle(
          this.x, this.y, this.r,
          this.dashDir.x * spd * dt,
          this.dashDir.y * spd * dt,
          { obstacles, bounds, maxStep: this.r * 0.42 }
        );
        this.x = moved.x;
        this.y = moved.y;
        this.focus = false;
        this.afterimageT -= dt;
        if (this.afterimageT <= 0) {
          this.afterimageT = 0.028;
          game.afterimages.push({ x: this.x, y: this.y, t: 0.32, life: 0.32, aim: this.aim, weapon: run.weapon, flip: this.flip });
        }
        if (st.dashDamage > 0) {
          for (const e of game.enemies) {
            if (e.dead || this.dashHit.has(e.id)) continue;
            if (U.dist(this.x, this.y - 12, e.x, e.y - 16) < 44 + e.r) {
              this.dashHit.add(e.id);
              game.damageEnemy(e, st.dashDamage * game.getDamageMul(), { angle: this.aim, knock: 140, x: e.x, y: e.y - 16, source: 'dash' });
              FX.burst(e.x, e.y - 18, '#57f4ff', 6, { speed: 160 });
            }
          }
          if (game.boss && !game.boss.dead && !this.dashHit.has('boss') && U.dist(this.x, this.y - 12, game.boss.x, game.boss.y - 60) < 100) {
            this.dashHit.add('boss');
            game.damageEnemy(game.boss, st.dashDamage * game.getDamageMul(), { angle: this.aim, x: game.boss.x, y: game.boss.y - 80, source: 'dash' });
          }
          for (const ob of game.world.obstacles) {
            if (!ob.destructible || ob.dead) continue;
            if (U.dist(this.x, this.y - 12, ob.x + ob.w / 2, ob.y + ob.h / 2) < 44 + Math.max(ob.w, ob.h) * 0.4) {
              game.damageObstacle(ob, st.dashDamage * 0.5, ob.x + ob.w / 2, ob.y + ob.h / 2);
            }
          }
        }
        if (this.dashT <= 0 && st.dodgeBlast) {
          game.explosion(this.x, this.y, 110, 130 * st.damage, '#57f4ff', 'player');
        }
      } else {
        const spd = run.speed * st.speed * (this.focus ? 0.82 : 1);
        const moved = U.moveCircle(
          this.x, this.y, this.r,
          mx * spd * dt,
          my * spd * dt,
          { obstacles, bounds, maxStep: this.r * 0.42 }
        );
        this.x = moved.x;
        this.y = moved.y;
        if (this.moving) {
          this.walk += dt * (1 + spd / 320);
          this.walked += spd * dt;
          if (Math.random() < dt * 8) {
            FX.add({ type: 'smoke', x: this.x + U.rand(-5, 5), y: this.y - 1, vx: U.rand(-8, 8), vy: -U.rand(4, 14), size: U.rand(2, 4), life: 0.5, color: 'rgba(140,180,200,0.13)' });
          }
        }
      }

      // weapons — hold fire while the room is cleared so doors can breathe
      const w = this.weapon;
      const holdFire = game.world && game.world.phase === 'cleared';
      const wantFire = !!input.firing || !!game.settings.autoFire;
      if (wasDashing) {
        this.stopBeam({ flush: true });
        C.updateHeat(this, dt, false);
      } else if (w.melee) {
        this.stopBeam({ flush: true });
        C.updateHeat(this, dt, false);
        const clicked = !!input.clickFire;
        input.clickFire = false;
        if (!holdFire) {
          let started = false;
          if (clicked || input.attackBuffer > 0) {
            started = this.tryMelee({ source: 'manual' });
          }
          if (!started && input.attackBuffer <= 0 && game.settings.autoMelee === true) {
            this.tryMelee({ source: 'auto' });
          }
        }
      } else if (w.beam) {
        if (input.clickFire) input.clickFire = false;
        if (holdFire || !wantFire) {
          this.stopBeam({ flush: true });
          C.updateHeat(this, dt, false);
        } else {
          const heat = C.updateHeat(this, dt, true);
          if (heat.activeDt > 0) this.updateBeam(heat.activeDt);
          else if (!this.beam) G.Audio.stopLaser();
          if (heat.overheatedNow) this.stopBeam({ flush: true });
        }
      } else {
        if (input.clickFire) input.clickFire = false;
        this.stopBeam({ flush: true });
        C.updateHeat(this, dt, false);
        if (!holdFire && wantFire && this.shootCd <= 0) this.shoot();
      }

      // auto nova
      if (st.autoNova) {
        this.autoNovaT += dt;
        if (this.autoNovaT >= 9) {
          this.autoNovaT = 0;
          game.nova(this.x, this.y, { power: 0.7, silent: true });
        }
      }
      // contact damage handled by enemies
    }

    stopBeam(opts) {
      opts = opts || {};
      const C = combat();
      const flush = opts.flush !== false && canAct(this.game);
      if (flush) C.flushLaser(this);
      else C.clearLaser(this);
      this.beam = null;
      this.laserTick = 0;
      this.laserTextT = 0;
      if (G.Audio && typeof G.Audio.stopLaser === 'function') G.Audio.stopLaser();
    }

    updateBeam(dt) {
      const beam = combat().updateBeam(this, dt);
      if (!beam) return;
      this.fireAnim = 0.6;
      this.attackAnimT = Math.max(this.attackAnimT, 0.09);
    }

    shoot() {
      const game = this.game;
      const run = game.run;
      const st = run.stats;
      const w = this.weapon;
      this.shootCd = w.cooldown / st.fireRate;
      this.fireAnim = 1;
      this.attackAnimT = 0.13;
      const baseDmg = w.damage * game.getDamageMul() * (1 + 0.12 * (run.weaponLevel - 1)) * (this.focus ? 1.12 : 1);
      const count = (w.count || 1) + st.projectile;
      const hasBig = SP.playerSprites && SP.playerSprites[run.character];
      const handX = this.x + (Math.cos(this.aim) >= 0 ? 9 : -9);
      const muzzleX = handX + Math.cos(this.aim) * 18;
      const muzzleY = this.y - (hasBig ? 50 : 26) + Math.sin(this.aim) * 18;
      const spread = (w.spread || 0) * (this.focus ? 0.7 : 1);
      for (let i = 0; i < count; i++) {
        const off = count === 1 ? U.rand(-spread, spread) : (i / (count - 1) - 0.5) * spread + U.rand(-0.02, 0.02);
        const a = this.aim + off;
        const b = new Bullet({
          x: muzzleX, y: muzzleY,
          vx: Math.cos(a) * w.speed * st.bulletSpeed,
          vy: Math.sin(a) * w.speed * st.bulletSpeed,
          r: (w.bulletSize || 4) * st.bulletSize,
          damage: baseDmg,
          critChance: game.getCrit(),
          critMult: st.critMult,
          camp: 'player',
          color: w.color,
          life: (w.life || 0.7) * (w.speed / st.bulletSpeed > 0 ? 1 : 1),
          pierce: (w.pierce || 0) + st.pierce,
          knock: (w.knock || 30) * st.knock,
          kind: run.weapon,
          ang: a,
        });
        game.bullets.push(b);
      }
      // muzzle
      FX.burst(muzzleX, muzzleY, w.color, 3, { angle: this.aim, spread: 0.4, speed: 130, drag: 0.8, lifeMul: 0.6 });
      FX.add({ type: 'flash', x: muzzleX, y: muzzleY, size: 12, life: 0.06, color: w.color });
      game.shake(1.2, 0.08);
      G.Audio.play(run.weapon === 'stapler' ? 'shoot2' : 'shoot', { pitch: 0.9 + Math.random() * 0.2 });
    }

    tryMelee(opts) {
      opts = opts || {};
      const game = this.game;
      const input = game.input;
      const w = this.weapon;
      const st = this.stats;
      if (!canAct(game) || this.dashT > 0 || !w || !w.melee ||
          this.meleeCd > 0 || this.meleeT > 0) return false;

      const auto = opts.source === 'auto' || opts.auto === true;
      if (auto && game.settings.autoMelee !== true) return false;

      const range = w.range * st.meleeRange;
      const origin = combat().getAimOrigin(this);
      let ang = this.aim;
      if (auto) {
        const target = game.nearestEnemy(this.x, this.y - 18, range + 34);
        if (!target) return false;
        const p = combat().getTargetPoint(target);
        ang = Math.atan2(p.y - origin.y, p.x - origin.x);
        const diff = Math.abs(Math.atan2(Math.sin(ang - this.aim), Math.cos(ang - this.aim)));
        if (diff > w.arc / 2 + 0.55) return false;
      }

      if (this.meleeComboT <= 0) this.meleeCombo = 0;
      const comboMax = Math.max(1, w.combo || 3);
      this.meleeCombo = (this.meleeCombo % comboMax) + 1;
      const heavy = this.meleeCombo >= comboMax;
      this.meleeDur = 0.2 / st.meleeSpeed;
      this.meleeT = this.meleeDur;
      this.meleeCd = (w.cooldown || 0.45) / st.meleeSpeed;
      this.meleeAng = ang;
      this.meleeComboT = 0.8;
      this.aim = ang;
      this.meleeHit = false;
      this.fireAnim = 1;
      this.attackAnimT = Math.max(0.18, this.meleeDur + 0.04);

      const moved = U.moveCircle(
        this.x, this.y, this.r,
        Math.cos(ang) * 7, Math.sin(ang) * 7,
        {
          obstacles: game.world && game.world.obstacles,
          bounds: game.world && game.world.bounds,
          maxStep: this.r * 0.42,
        }
      );
      this.x = moved.x;
      this.y = moved.y;

      // Only a successful start consumes the buffered manual attack.
      input.attackBuffer = 0;
      if (!auto) input.clickFire = false;
      FX.ring(this.x, this.y - (this.aimHeight > 30 ? 48 : 22), 5, range * 0.7, '#57f4ff', 0.16, 2);
      G.Audio.play('meleeSwing', { pitch: heavy ? 0.72 : 0.9 + this.meleeCombo * 0.07 });
      if (heavy) FX.text(this.x, this.y - 74, 'HEAVY', '#ffd24a', { scale: 1.55, life: 0.44 });
      return true;
    }

    updateMelee(dt) {
      if (this.meleeT <= 0) return;
      this.meleeT -= dt;
      if (this.meleeHit || this.meleeT > this.meleeDur - 0.055) return;
      this.meleeHit = true;
      const game = this.game;
      const w = this.weapon;
      const st = this.stats;
      const range = w.range * st.meleeRange;
      const half = w.arc / 2;
      const combo = this.meleeCombo;
      const heavy = combo >= (w.combo || 3);
      const dmgBase = w.damage * (heavy ? 1.7 : 1) * st.meleePower * game.getDamageMul() * (this.focus ? 1.1 : 1);
      let hitAny = false;
      const C = combat();
      const origin = C.getAimOrigin(this);
      const hit = (e, isBoss) => {
        const p = C.getTargetPoint(e);
        const dist = U.dist(origin.x, origin.y, p.x, p.y);
        const reach = range + p.r;
        if (dist > reach) return;
        const a = Math.atan2(p.y - origin.y, p.x - origin.x);
        const diff = Math.abs(Math.atan2(Math.sin(a - this.meleeAng), Math.cos(a - this.meleeAng)));
        if (diff > half + (isBoss ? 0.35 : 0.18)) return;
        game.damageEnemy(e, dmgBase, { angle: this.meleeAng, knock: (w.knock || 200) * st.knock * (heavy ? 1.4 : 1), x: p.x, y: p.y, source: 'melee' });
        hitAny = true;
      };
      for (const e of game.enemies) if (!e.dead) hit(e, false);
      if (game.boss && !game.boss.dead) hit(game.boss, true);
      for (const ob of game.world.obstacles) {
        if (!ob.destructible || ob.dead) continue;
        const ox = ob.x + ob.w / 2;
        const oy = ob.y + ob.h / 2;
        const reach = range + Math.max(ob.w, ob.h) * 0.45;
        if (U.dist(origin.x, origin.y, ox, oy) > reach) continue;
        const a = Math.atan2(oy - origin.y, ox - origin.x);
        const diff = Math.abs(Math.atan2(Math.sin(a - this.meleeAng), Math.cos(a - this.meleeAng)));
        if (diff <= half + 0.2) {
          game.damageObstacle(ob, dmgBase * 0.75, ox, oy);
          hitAny = true;
        }
      }
      if (hitAny) {
        game.hitstop(heavy ? 0.045 : 0.025);
        game.shake(heavy ? 5 : 2.5, heavy ? 0.22 : 0.1);
        FX.burst(this.x + Math.cos(this.meleeAng) * range * 0.65, this.y - 22 + Math.sin(this.meleeAng) * range * 0.5, '#bffcff', heavy ? 14 : 7, { speed: heavy ? 260 : 160, drag: 0.8 });
        G.Audio.play('meleeHit', { pitch: heavy ? 0.8 : 1.15 });
      }
      if (heavy) {
        FX.ring(this.x, this.y - 22, 8, range * 0.9, '#ffd24a', 0.28, 3);
        if (st.meleeThirdBlast) game.explosion(this.x, this.y, 92, 18 * st.meleePower, '#57f4ff', 'player');
        game.shake(4, 0.18);
      }
    }

    tryDash() {
      const game = this.game;
      if (!canAct(game)) return false;
      if (this.dashCharge <= 0 || this.dashT > 0) {
        if (this.dashCharge <= 0) {
          const el = document.getElementById('dash-cool');
          if (el) { el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny'); }
          G.Audio.play('deny');
        }
        return false;
      }
      this.stopBeam({ flush: true });
      this.meleeT = 0;
      this.meleeHit = true;
      this.meleeCombo = 0;
      this.meleeComboT = 0;
      const input = game.input;
      let dx = 0, dy = 0;
      if (input.keys['a'] || input.keys['arrowleft']) dx -= 1;
      if (input.keys['d'] || input.keys['arrowright']) dx += 1;
      if (input.keys['w'] || input.keys['arrowup']) dy -= 1;
      if (input.keys['s'] || input.keys['arrowdown']) dy += 1;
      if (input.touch.x || input.touch.y) { dx = input.touch.x; dy = input.touch.y; }
      if (!dx && !dy) { dx = Math.cos(this.aim); dy = Math.sin(this.aim); }
      const l = Math.hypot(dx, dy) || 1;
      this.dashDir = { x: dx / l, y: dy / l };
      this.dashT = 0.16;
      this.dashCharge--;
      if (this.dashRecharge <= 0) this.dashRecharge = this.stats.dodgeCd;
      this.dashHit.clear();
      this.invuln = Math.max(this.invuln, 0.3);
      this.afterimageT = 0;
      FX.burst(this.x, this.y, '#57f4ff', 12, { speed: 180, drag: 0.82 });
      FX.ring(this.x, this.y, 4, 26, '#57f4ff', 0.25, 2);
      G.Audio.play('dodge');
      if (this.stats.bulletTime) game.slowMo(0.35, 0.9);
      return true;
    }

    trySkill() {
      const game = this.game;
      if (!canAct(game)) return false;
      if (this.skillCd > 0) {
        G.Audio.play('deny');
        const el = document.getElementById('skill-cool');
        if (el) { el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny'); }
        return false;
      }
      this.skillCd = this.stats.skillCd;
      if (Math.random() < this.stats.skillEcho) {
        this.skillCd *= 0.5;
        FX.text(this.x, this.y - 64, 'ECHO', '#57f4ff', { scale: 1.4, life: 0.6 });
      }
      this.invuln = Math.max(this.invuln, 0.22);
      if (game.run.skillId === 'hotfix') game.castHotfix(this);
      else game.castDeadline(this);
      return true;
    }

    trySkill2() {
      const game = this.game;
      if (!canAct(game)) return false;
      if (this.skill2Cd > 0) {
        G.Audio.play('deny');
        const el = document.getElementById('skill2-cool');
        if (el) { el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny'); }
        return false;
      }
      this.skill2Cd = this.stats.skill2Cd;
      if (Math.random() < this.stats.skillEcho) {
        this.skill2Cd *= 0.5;
        FX.text(this.x, this.y - 64, 'ECHO', '#57f4ff', { scale: 1.4, life: 0.6 });
      }
      this.invuln = Math.max(this.invuln, 0.25);
      if (game.run.skill2Id === 'enter') game.castEnter(this);
      else game.castGaze(this);
      return true;
    }

    takeDamage(amount, opts) {
      opts = opts || {};
      if (this.dead || this.invuln > 0 || this.dashT > 0) return false;
      const st = this.stats;
      if (Math.random() < st.immuneChance) {
        FX.text(this.x, this.y - 52, 'BLOCK', '#57f4ff', { scale: 2, life: 0.6 });
        G.Audio.play('deny');
        return false;
      }
      let dmg = amount * (1 - Math.min(0.65, st.armor)) * U.rand(0.92, 1.06);
      dmg = Math.max(1, dmg);
      const game = this.game;
      if (game.run.shield > 0) {
        const absorbed = Math.min(game.run.shield, dmg);
        game.run.shield -= absorbed;
        dmg -= absorbed;
        FX.ring(this.x, this.y - 26, 12, 34, '#57f4ff', 0.22, 2);
      }
      if (dmg > 0) {
        game.run.hp -= dmg;
        this.hurtT = 0.18;
        FX.text(this.x, this.y - 54, '-' + Math.round(dmg), '#ff5e6e', { scale: 2.4 });
        FX.burst(this.x, this.y - 24, '#ff3d5e', 10, { speed: 200, drag: 0.8 });
        FX.flash('hurt');
        FX.shake(7, 0.32);
        game.hitstop(0.06);
        this.hitFlash = 1;
        this.invuln = 0.72;
        G.Audio.play('hurt');
        game.setHpDebounce();
      }
      if (game.run.hp <= 0) {
        if (st.revive > 0 && (!G.Modes || G.Modes.canRevive(game.run))) {
          st.revive--;
          game.run.hp = game.run.maxHp * 0.3;
          game.run.shield = Math.max(game.run.shield, 20);
          this.invuln = 2.2;
          game.clearEnemyBullets();
          FX.ring(this.x, this.y, 10, 160, '#ffd24a', 0.6, 4);
          FX.flash('white');
          game.toast('周报豁免：你被从死亡里捞了回来', 'gold');
          G.Audio.play('levelup');
        } else {
          game.run.hp = 0;
          this.die();
        }
      }
      return true;
    }

    notifyDodge() {
      if (this.dodgeTextCd > 0) return false;
      this.dodgeTextCd = 0.5;
      FX.text(this.x, this.y - 62, 'DODGE', '#57f4ff', { scale: 1.8, life: 0.48 });
      return true;
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      G.Audio.play('gameover');
      G.Audio.stopLaser();
      FX.death(this.x, this.y - 20, '#57f4ff', 1.6);
      FX.flash('white');
      FX.shake(14, 0.7);
      this.game.gameOver();
    }

    draw(ctx, t) {
      const game = this.game;
      // shield halo behind the character
      const bigSprite = SP.playerSprites && SP.playerSprites[game.run.character];
      if (game.run.shield > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(87,244,255,' + (0.14 + Math.sin(t * 5) * 0.05) + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - (bigSprite ? 54 : 30), bigSprite ? 38 : 32, bigSprite ? 55 : 43, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      SP.drawPlayer(ctx, game.run.character, this.x, this.y, {
        t,
        walk: this.walk,
        moving: this.moving,
        flip: this.flip,
        aim: this.aim,
        weapon: game.run.weapon,
        flash: this.hitFlash,
        blink: this.blinkT > 0,
        dashT: this.dashT,
        attackT: this.attackAnimT,
        hurtT: this.hurtT,
        weaponY: this.aimHeight,
        showWeapon: this.weapon.id !== 'laser' || this.fireAnim > 0.05 || this.attackAnimT > 0,
        alpha: this.dead ? 0 : 1,
      });
      // melee arc
      if (this.meleeT > 0) {
        const w = this.weapon;
        const k = Math.max(0, this.meleeT / this.meleeDur);
        const range = w.range * this.stats.meleeRange;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(87,244,255,' + (0.18 * k) + ')';
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.arc(this.x, this.y - (bigSprite ? 48 : 22), range * 0.78, this.meleeAng - w.arc / 2, this.meleeAng + w.arc / 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(220,255,255,' + (0.8 * k) + ')';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(this.x, this.y - (bigSprite ? 48 : 22), range * 0.8, this.meleeAng - w.arc / 2, this.meleeAng + w.arc / 2);
        ctx.stroke();
        ctx.restore();
      }
      if (this.beam) {
        const b = this.beam;
        const C = combat();
        const heatRange = Math.max(0.001, 1 - C.hotResetAt);
        const heatTint = U.clamp((this.laserHeat - C.hotResetAt) / heatRange, 0, 1) * 0.55;
        const beamColor = U.mix(this.weapon.color, '#ffb347', heatTint);
        const coreColor = U.mix('#eaffff', '#ffe2a0', heatTint * 0.7);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // outer glow
        ctx.strokeStyle = U.rgba(beamColor, 0.12);
        ctx.lineWidth = Math.max(8, (this.weapon.beamWidth || 5) * 2.2);
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.strokeStyle = U.rgba(beamColor, 0.38);
        ctx.lineWidth = this.weapon.beamWidth || 5;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.strokeStyle = coreColor;
        ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        // emitter and impact
        U.glow(ctx, b.x1, b.y1, 12, beamColor, 0.4);
        U.glow(ctx, b.x2, b.y2, 16, beamColor, 0.35);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(b.x2 - 1.5, b.y2 - 1.5, 3, 3);
        ctx.restore();
      }
      // dash cooldown ring on ground
      if (this.dashT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#57f4ff';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, 26, 8, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      // low hp vignette is on hud
      if (game.run.hp / game.run.maxHp < 0.3 && !this.dead) {
        const a = 0.08 + Math.sin(t * 4) * 0.04;
        ctx.save();
        ctx.fillStyle = 'rgba(255,30,50,' + a + ')';
        ctx.fillRect(0, 0, U.W, U.H);
        ctx.restore();
      }
    }
  }
  G.Player = Player;

  // ============================================================
  // BULLET
  // ============================================================
  class Bullet {
    constructor(o) {
      Object.assign(this, o);
      this.trail = [];
      this.hitSet = [];
      this.t = 0;
      this.dead = false;
      this.maxLife = this.life;
      this.spin = Math.random() * TAU;
    }

    update(dt, game) {
      this.t += dt;
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 6) this.trail.shift();
      if (this.homing && this.homing > 0) {
        const target = game.player;
        const a = Math.atan2(target.y - 26 - this.y, target.x - this.x);
        const cur = Math.atan2(this.vy, this.vx);
        const na = U.angleLerp(cur, a, Math.min(1, dt * this.homing));
        const sp = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(na) * sp;
        this.vy = Math.sin(na) * sp;
      }
      if (this.accel) {
        const sp = Math.hypot(this.vx, this.vy);
        const na = Math.atan2(this.vy, this.vx);
        const nsp = sp + this.accel * dt;
        this.vx = Math.cos(na) * nsp;
        this.vy = Math.sin(na) * nsp;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.spin += dt * 8;

      // room bounds
      const b = game.world.bounds;
      if (this.x < b.x - 40 || this.x > b.x + b.w + 40 || this.y < b.y - 40 || this.y > b.y + b.h + 40) {
        this.dead = true;
        return;
      }
      if (!this.ghost) {
        for (const ob of game.world.obstacles) {
          if (ob.solid === false || ob.dead) continue;
          if (U.circleRect(this.x, this.y, this.r * 0.7, ob)) {
            if (ob.destructible) game.damageObstacle(ob, this.damage * (this.camp === 'player' ? 0.9 : 0.5), this.x, this.y);
            this.dead = true;
            FX.burst(this.x, this.y, this.color || '#fff', 4, { speed: 90, drag: 0.8 });
            return;
          }
        }
      }
      if (this.camp === 'player') {
        for (const e of game.enemies) {
          if (e.dead || this.hitSet.indexOf(e.id) >= 0) continue;
          if (U.dist(this.x, this.y, e.x, e.y - (e.hitY || 12)) < this.r + e.r) {
            this.hitSet.push(e.id);
            game.damageEnemy(e, this.damage, {
              critChance: this.critChance,
              critMult: this.critMult,
              angle: Math.atan2(this.vy, this.vx),
              knock: this.knock,
              source: this.kind,
              x: this.x, y: this.y,
            });
            if (this.pierce > 0) {
              this.pierce--;
            } else {
              this.dead = true;
              return;
            }
          }
        }
        const boss = game.boss;
        if (boss && !boss.dead && this.hitSet.indexOf('boss') < 0 && U.dist(this.x, this.y, boss.x, boss.y - 66) < this.r + 68) {
          this.hitSet.push('boss');
          game.damageEnemy(boss, this.damage, {
            critChance: this.critChance, critMult: this.critMult,
            angle: Math.atan2(this.vy, this.vx), knock: 0,
            source: this.kind, x: this.x, y: this.y,
          });
          if (this.pierce > 0) this.pierce--; else { this.dead = true; return; }
        }
      } else {
        const p = game.player;
        if (p && !p.dead && U.dist(this.x, this.y, p.x, p.y - 24) < this.r + p.r) {
          const hit = p.takeDamage(this.damage, { source: this.owner });
          if (hit) this.dead = true;
          else if (p.dashT > 0) {
            p.notifyDodge();
            this.dead = false;
          }
          else this.dead = true;
        }
      }
    }

    draw(ctx) {
      const col = this.color || '#ff3d5e';
      ctx.save();
      if (this.kind === 'laser') { ctx.restore(); return; }
      // trail
      if (this.camp === 'player') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.rgba(col, 0.28);
        ctx.lineWidth = this.r * 1.3;
        ctx.beginPath();
        if (this.trail.length) {
          ctx.moveTo(this.trail[0].x, this.trail[0].y);
          for (const p of this.trail) ctx.lineTo(p.x, p.y);
          ctx.lineTo(this.x, this.y);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        U.glow(ctx, this.x, this.y, this.r * 4.4, col, 0.2);
        ctx.restore();
      }
      if (this.kind === 'keyboard') {
        ctx.translate(this.x, this.y);
        ctx.rotate(this.ang || Math.atan2(this.vy, this.vx));
        ctx.fillStyle = '#0a1520';
        ctx.fillRect(-this.r - 1, -this.r - 1, this.r * 2 + 2, this.r * 2 + 2);
        ctx.fillStyle = col;
        ctx.fillRect(-this.r, -this.r, this.r * 2, this.r * 2);
        ctx.fillStyle = '#eaffff';
        ctx.fillRect(-this.r + 1, -this.r + 1, this.r, this.r);
      } else if (this.kind === 'stapler') {
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.vy, this.vx));
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(-this.r * 1.6, -1, this.r * 3.2, 2);
        ctx.fillStyle = '#fff2c0';
        ctx.fillRect(-this.r * 1.2, -0.5, this.r * 1.2, 1);
      } else if (this.kind === 'hotfix') {
        ctx.translate(this.x, this.y);
        ctx.rotate(this.ang || Math.atan2(this.vy, this.vx));
        ctx.fillStyle = '#0a1520';
        ctx.fillRect(-this.r * 1.9, -this.r * 1.3, this.r * 3.8, this.r * 2.6);
        ctx.fillStyle = '#57f4ff';
        ctx.fillRect(-this.r * 1.4, -this.r * 0.9, this.r * 2.8, this.r * 1.8);
        ctx.fillStyle = '#eaffff';
        ctx.fillRect(-this.r * 0.9, -this.r * 0.4, this.r * 1.8, this.r * 0.8);
        ctx.fillStyle = '#0a1520';
        ctx.fillRect(-this.r * 0.45, -this.r * 0.95, this.r * 0.9, this.r * 0.5);
      } else if (this.kind === 'paper') {
        ctx.translate(this.x, this.y);
        ctx.rotate(this.spin);
        ctx.fillStyle = '#e9e4d2';
        ctx.fillRect(-this.r, -this.r * 0.8, this.r * 2, this.r * 1.6);
        ctx.fillStyle = '#b8b2a0';
        ctx.fillRect(-this.r, -this.r * 0.8, this.r * 2, 1);
      } else if (this.kind === 'report') {
        ctx.translate(this.x, this.y);
        ctx.rotate(this.spin * 0.6);
        ctx.fillStyle = '#2a0a10';
        ctx.fillRect(-this.r * 1.6, -this.r, this.r * 3.2, this.r * 2);
        ctx.fillStyle = col;
        ctx.fillRect(-this.r * 1.4, -this.r * 0.8, this.r * 2.8, this.r * 1.6);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        for (let i = 0; i < 3; i++) ctx.fillRect(-this.r * 1.1, -this.r * 0.4 + i * 2.4, this.r * 1.8, 0.8);
      } else if (this.kind === 'seal') {
        ctx.globalCompositeOperation = 'lighter';
        U.glow(ctx, this.x, this.y, this.r * 4, col, 0.35);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#3a0710';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 1.35, 0, TAU); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe0e0';
        ctx.fillRect(this.x - 1.5, this.y - this.r * 0.5, 3, this.r);
        ctx.fillRect(this.x - this.r * 0.5, this.y - 1.5, this.r, 3);
      } else if (this.kind === 'glob') {
        ctx.globalCompositeOperation = 'lighter';
        U.glow(ctx, this.x, this.y, this.r * 4, col, 0.25);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(this.x - this.r * 0.3, this.y - this.r * 0.3, this.r * 0.3, 0, TAU); ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        U.glow(ctx, this.x, this.y, this.r * 3.2, col, 0.3);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(this.x - this.r * 0.2, this.y - this.r * 0.2, this.r * 0.35, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
  G.Bullet = Bullet;

  // ============================================================
  // ENEMY
  // ============================================================
  let enemyId = 1;
  class Enemy {
    constructor(game, type, x, y, opt) {
      const data = G.DATA.enemies[type] || G.DATA.enemies.paper;
      this.game = game;
      this.id = enemyId++;
      this.type = type;
      this.data = data;
      this.x = x; this.y = y;
      this.r = data.radius;
      this.hpMax = data.hp * (opt.hpMul || 1);
      this.hp = this.hpMax;
      this.speed = data.speed * (opt.speedMul || 1);
      this.damage = data.damage * (opt.dmgMul || 1);
      this.elite = !!data.elite;
      this.state = 'spawn';
      this.stateT = 0.45;
      this.fireCd = U.rand(0.8, 1.8);
      this.angle = 0;
      this.hitFlash = 0;
      this.dead = false;
      this.touchCd = 0;
      this.wanderT = 0;
      this.wanderA = Math.random() * TAU;
      this.bobT = Math.random() * 10;
      this.telegraph = null;
      this.armored = !!data.elite;
      this.armorT = 0;
      this.summonCd = 6;
      this.fear = 0;
      this.slow = 0;
      this.markT = 0;
      this.markAmp = 0;
      this.stunT = 0;
      this.kx = 0; this.ky = 0;
      this.chargeDir = { x: 0, y: 0 };
      this.hitY = data.sprite === 'ghost' ? 26 : data.sprite === 'paper' ? 16 : 22;
      this.spawnT = 0.45;
      this.knockRes = data.elite ? 0.25 : 1;
      this.bossLite = data.ai === 'boss_lite';
      this.shots = 0;
    }

    get alive() { return !this.dead; }

    update(dt, game) {
      if (this.dead) return;
      this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
      this.touchCd = Math.max(0, this.touchCd - dt);
      this.fireCd -= dt;
      this.summonCd -= dt;
      this.fear = Math.max(0, this.fear - dt);
      this.slow = Math.max(0, this.slow - dt);
      this.markT = Math.max(0, this.markT - dt);
      this.stunT = Math.max(0, this.stunT - dt);
      if (this.stunT > 0) return;
      if (this.state === 'stun') this.state = 'chase';
      this.spawnT -= dt;
      this.bobT += dt;
      if (this.kx || this.ky) {
        this.x += this.kx * dt;
        this.y += this.ky * dt;
        this.kx *= Math.pow(0.0005, dt);
        this.ky *= Math.pow(0.0005, dt);
      }
      if (this.spawnT > 0) {
        this.state = 'spawn';
        return;
      }
      const player = game.player;
      if (!player || player.dead) return;
      const dx = player.x - this.x;
      const dy = player.y - 24 - (this.y - 24);
      const dist = Math.hypot(dx, dy) || 1;
      this.angle = Math.atan2(dy, dx);
      const slowMul = (this.slow > 0 ? 0.55 : 1) * (this.markT > 0 ? 0.75 : 1);
      const fearMul = this.fear > 0 ? -0.75 : 1;
      const ai = this.data.ai;
      this.telegraph = null;

      if (this.state === 'charge') {
        this.stateT -= dt;
        this.x += this.chargeDir.x * this.data.chargeSpeed * dt;
        this.y += this.chargeDir.y * this.data.chargeSpeed * dt;
        if (Math.random() < 0.5) FX.spark(this.x, this.y + 2, this.angle + Math.PI, 60, '#ffb35c', { life: 0.2 });
        if (this.stateT <= 0) { this.state = 'recover'; this.stateT = 0.7; }
      } else if (this.state === 'windup') {
        this.stateT -= dt;
        this.telegraph = { type: 'charge', dir: this.chargeDir, t: 1 - this.stateT / this.data.windup };
        if (this.stateT <= 0) {
          this.state = 'charge';
          this.stateT = this.data.chargeTime || 0.3;
          G.Audio.play('warn');
        }
      } else if (this.state === 'recover') {
        this.stateT -= dt;
        if (this.stateT <= 0) this.state = 'move';
      } else if (this.state === 'cast') {
        this.stateT -= dt;
        this.telegraph = { type: this.castType || 'aim', t: 1 - this.stateT / (this.castDur || 0.5) };
        if (this.stateT <= 0) {
          this.executeCast(game, dist);
          this.state = 'move';
          this.stateT = 0.3;
          this.fireCd = this.data.fireRate || 2;
        }
      } else {
        // move state
        let mvx = 0, mvy = 0;
        if (ai === 'chase') {
          mvx = dx / dist; mvy = dy / dist;
          if (dist < this.r + player.r + 2) {
            // touch damage handled separately
          }
        } else if (ai === 'ranged') {
          const pref = this.data.preferred || 280;
          if (dist > pref + 30) { mvx = dx / dist; mvy = dy / dist; }
          else if (dist < pref - 50) { mvx = -dx / dist; mvy = -dy / dist; }
          else { mvx = -dy / dist * 0.55; mvy = dx / dist * 0.55; }
        } else if (ai === 'strafer') {
          const pref = this.data.preferred || 320;
          const tang = this.angle + Math.PI / 2 * (this.wanderA > Math.PI ? 1 : -1);
          if (dist > pref + 30) { mvx = dx / dist; mvy = dy / dist; }
          else if (dist < pref - 60) { mvx = -dx / dist; mvy = -dy / dist; }
          else { mvx = Math.cos(tang) * 0.85; mvy = Math.sin(tang) * 0.85; }
          this.wanderT -= dt;
          if (this.wanderT <= 0) { this.wanderT = U.rand(1.4, 2.8); this.wanderA = Math.random() * TAU; }
        } else if (ai === 'ghost') {
          mvx = dx / dist; mvy = dy / dist;
        } else if (ai === 'charger') {
          if (dist > 120) { mvx = dx / dist; mvy = dy / dist; }
          else { mvx = -dx / dist * 0.5; mvy = -dy / dist * 0.5; }
        } else if (ai === 'boss_lite') {
          const pref = 240;
          if (dist > pref) { mvx = dx / dist * 0.8; mvy = dy / dist * 0.8; }
          else if (dist < pref - 70) { mvx = -dx / dist * 0.6; mvy = -dy / dist * 0.6; }
          if (this.summonCd <= 0) {
            this.summonCd = 7.5;
            this.castType = 'summon';
            this.castDur = 0.8;
            this.state = 'cast';
            this.stateT = 0.8;
            this.fireCd = 0.5;
          } else if (this.fireCd <= 0) {
            this.castType = 'fan';
            this.castDur = 0.48;
            this.state = 'cast';
            this.stateT = 0.48;
          }
        }

        let sp = this.speed * slowMul * (this.fear > 0 ? 0 : 1);
        this.x += mvx * sp * dt;
        this.y += mvy * sp * dt;

        if (ai === 'charger' && this.fireCd <= 0 && dist < 260 && dist > 40) {
          this.state = 'windup';
          this.stateT = this.data.windup;
          this.chargeDir = { x: dx / dist, y: dy / dist };
          this.fireCd = 2.6;
          this.telegraph = { type: 'charge', dir: this.chargeDir, t: 0 };
        } else if ((ai === 'ranged' || ai === 'strafer') && this.fireCd <= 0 && dist < 560) {
          this.castType = 'shot';
          this.castDur = 0.45;
          this.state = 'cast';
          this.stateT = 0.45;
        } else if (ai === 'ghost' && this.fireCd <= 0 && dist < 520) {
          this.castType = 'ghostshot';
          this.castDur = 0.4;
          this.state = 'cast';
          this.stateT = 0.4;
        }
      }

      // fear movement
      if (this.fear > 0 && this.state === 'move') {
        this.x -= dx / dist * this.speed * 0.8 * dt;
        this.y -= dy / dist * this.speed * 0.8 * dt;
      }

      // obstacle collision (ghost ignores)
      if (ai !== 'ghost') {
        const res = game.resolveObstacles(this.x, this.y, this.r);
        this.x = res.x; this.y = res.y;
      }
      const b = game.world.bounds;
      this.x = U.clamp(this.x, b.x + this.r, b.x + b.w - this.r);
      this.y = U.clamp(this.y, b.y + this.r, b.y + b.h - this.r);

      // touch damage
      if (this.touchCd <= 0 && dist < this.r + player.r + 3) {
        const kind = this.data.sprite === 'zombie' ? 'zombie' : this.data.sprite === 'printer' ? 'printer' : 'paper';
        if (player.takeDamage(this.damage, { source: kind })) {
          this.touchCd = 0.85;
          const kx = -dx / dist, ky = -dy / dist;
          player.x += kx * 12; player.y += ky * 12;
        }
      }
      // contact with bullets is in bullet update
    }

    executeCast(game, dist) {
      const data = this.data;
      const player = game.player;
      const muzzleY = this.y - (this.data.sprite === 'ghost' ? 30 : 20);
      if (this.castType === 'summon') {
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * TAU;
          const p = game.findSpawnPoint(this.x + Math.cos(a) * 90, this.y + Math.sin(a) * 70);
          game.spawnEnemy(Math.random() < 0.5 ? 'paper' : 'zombie', p.x, p.y, { hpMul: 0.8, spawnFx: true });
        }
        FX.ring(this.x, this.y, 10, 120, '#ffd24a', 0.5, 3);
        G.Audio.play('spawn');
        this.armorT = 1.6;
        return;
      }
      if (this.castType === 'fan') {
        const n = 5;
        for (let i = 0; i < n; i++) {
          const a = this.angle + (i - (n - 1) / 2) * 0.18;
          game.spawnBullet({
            x: this.x, y: muzzleY, ang: a, speed: data.bulletSpeed || 220,
            damage: data.bulletDamage || 10, kind: 'report', color: '#ff7b3d', r: 5, owner: 'supervisor',
          });
        }
        G.Audio.play('shoot2');
        return;
      }
      if (this.castType === 'ghostshot') {
        game.spawnBullet({
          x: this.x, y: muzzleY, ang: this.angle, speed: data.bulletSpeed || 150,
          damage: data.bulletDamage || 8, kind: 'glob', color: '#7dffa8', r: 5,
          homing: 1.4, life: 3.4, owner: 'ghost', ghost: true,
        });
        G.Audio.play('shoot');
        return;
      }
      if (this.castType === 'shot') {
        if (data.burst && data.burst > 1) {
          for (let i = 0; i < data.burst; i++) {
            setTimeout(() => {
              if (this.dead || game.state !== 'play') return;
              const a = Math.atan2(game.player.y - 24 - muzzleY, game.player.x - this.x);
              game.spawnBullet({
                x: this.x, y: muzzleY, ang: a, speed: data.bulletSpeed,
                damage: data.bulletDamage, kind: 'glob', color: '#ff3d5e', r: 4, owner: 'drone',
              });
              G.Audio.play('shoot', { pitch: 1.3 });
            }, i * 120);
          }
        } else {
          const a = Math.atan2(player.y - 24 - muzzleY, player.x - this.x);
          game.spawnBullet({
            x: this.x, y: muzzleY, ang: a, speed: data.bulletSpeed || 200,
            damage: data.bulletDamage || 9, kind: 'paper', color: '#d8d3c2', r: 5, owner: 'printer',
          });
          G.Audio.play('shoot2');
        }
        this.shots++;
      }
    }

    takeDamage(dmg, opts) {
      if (this.dead) return 0;
      opts = opts || {};
      let mult = 1;
      if (this.armorT > 0) mult = 0.45;
      const soft = !!opts.softHit;
      const raw = Math.max(0, (Number.isFinite(dmg) ? dmg : 0) * mult);
      const final = soft ? raw : Math.max(1, raw);
      if (!(final > 0)) return 0;
      const before = this.hp;
      this.hp -= final;
      this.hitFlash = opts.softHit ? Math.min(0.5, this.hitFlash + 0.3) : 1;
      if (!soft) FX.hit(opts.x || this.x, opts.y || this.y - 14, opts.angle || 0, this.data.sprite === 'ghost' ? '#7dffa8' : '#ffd9a8', opts.crit);
      if (opts.knock && this.knockRes) {
        const k = opts.knock * this.knockRes;
        this.kx += Math.cos(opts.angle || 0) * k;
        this.ky += Math.sin(opts.angle || 0) * k;
      }
      if (!soft && this.data.ai === 'ghost' && Math.random() < 0.4) {
        this.x += U.rand(-8, 8);
        this.y += U.rand(-8, 8);
      }
      if (this.hp <= 0) this.game.killEnemy(this);
      return Math.max(0, Math.min(before, final));
    }

    draw(ctx, t) {
      const o = {
        t: this.bobT,
        flash: this.hitFlash,
        armored: this.armorT > 0 || (this.data.elite && this.state !== 'cast'),
        eyeDir: this.angle,
      };
      // spawn effect
      if (this.spawnT > 0) {
        const k = 1 - this.spawnT / 0.45;
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#ff3d5e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 10, 44 * (1 - k), 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      // fear / slow markers
      if (this.slow > 0) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#57f4ff';
        ctx.fillRect(this.x - 12, this.y - 54, 24, 2);
        ctx.restore();
      }
      SP.drawEnemy(ctx, this.data.sprite, this.x, this.y, o);
      // health bar
      if (this.hp < this.hpMax && this.hp > 0) {
        const w = this.data.elite ? 58 : 30;
        const hp = this.hp / this.hpMax;
        const off = this.data.sprite === 'zombie' ? 72 : this.data.sprite === 'printer' ? 58 : this.data.sprite === 'ghost' ? 62 : this.data.sprite === 'supervisor' ? 94 : 50;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(this.x - w / 2 - 1, this.y - off - 1, w + 2, 6);
        ctx.fillStyle = this.data.elite ? '#ffd24a' : '#ff4d5e';
        ctx.fillRect(this.x - w / 2, this.y - off, w * hp, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(this.x - w / 2, this.y - off, w * hp, 1);
      }
      // elite halo
      if (this.data.elite) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        U.glow(ctx, this.x, this.y - 34, 60, '#ffd24a', 0.1);
        ctx.restore();
      }
      if (this.markT > 0) drawMark(ctx, this.x, this.y - (this.data.elite ? 88 : 52), t);
      if (this.stunT > 0) drawStun(ctx, this.x, this.y - (this.data.elite ? 98 : 62), t);
      // telegraphs
      if (this.telegraph) this.drawTelegraph(ctx);
    }

    drawTelegraph(ctx) {
      const tg = this.telegraph;
      if (tg.type === 'charge') {
        const d = tg.dir;
        const len = 220 * (0.4 + tg.t * 0.6);
        ctx.save();
        ctx.translate(this.x, this.y + 2);
        ctx.rotate(Math.atan2(d.y, d.x));
        ctx.fillStyle = 'rgba(255,60,70,' + (0.12 + tg.t * 0.12) + ')';
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(len, -4);
        ctx.lineTo(len, 4);
        ctx.lineTo(0, 14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,90,90,' + (0.5 + tg.t * 0.4) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, 0); ctx.lineTo(len, 0);
        ctx.stroke();
        ctx.restore();
      } else if (tg.type === 'aim') {
        ctx.save();
        ctx.globalAlpha = 0.5 + tg.t * 0.3;
        ctx.strokeStyle = '#ff3d5e';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        const a = Math.atan2(this.game.player.y - 24 - (this.y - 20), this.game.player.x - this.x);
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - 20);
        ctx.lineTo(this.x + Math.cos(a) * 500, this.y - 20 + Math.sin(a) * 500);
        ctx.stroke();
        ctx.restore();
      } else if (tg.type === 'fan') {
        ctx.save();
        ctx.translate(this.x, this.y - 20);
        ctx.rotate(this.angle);
        ctx.fillStyle = 'rgba(255,50,60,' + (0.1 + tg.t * 0.14) + ')';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 260, -0.45, 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }
  G.Enemy = Enemy;

  // ============================================================
  // BOSS — KPI-0
  // ============================================================
  class Boss {
    constructor(game) {
      this.game = game;
      this.x = U.W / 2;
      this.y = 190;
      this.r = 68;
      this.hitY = 60;
      this.hitRadius = 68;
      this.hpMax = G.DATA.boss.hp;
      this.hp = this.hpMax;
      this.phase = 1;
      this.state = 'intro';
      this.stateT = 2.2;
      this.attack = null;
      this.attackT = 0;
      this.dead = false;
      this.hitFlash = 0;
      this.t = 0;
      this.touchCd = 0;
      this.eyeDir = 0;
      this.targetX = this.x;
      this.moveT = 0;
      this.sweep = null;
      this.nextAttack = 'spread';
      this.invuln = 0;
      this.introDone = false;
      this.markT = 0;
      this.markAmp = 0;
      this.stunT = 0;
    }

    update(dt, game) {
      this.t += dt;
      this.hitFlash = Math.max(0, this.hitFlash - dt * 5);
      this.touchCd = Math.max(0, this.touchCd - dt);
      this.invuln = Math.max(0, this.invuln - dt);
      this.markT = Math.max(0, this.markT - dt);
      this.stunT = Math.max(0, this.stunT - dt);
      if (this.stunT > 0) { this.state = 'stun'; return; }
      if (this.state === 'stun') { this.state = 'idle'; this.stateT = 0.3; }
      const p = game.player;
      if (!p || p.dead) return;
      this.eyeDir = U.angleLerp(this.eyeDir, Math.atan2(p.y - 24 - (this.y - 60), p.x - this.x), Math.min(1, dt * 4));

      // phases
      const ratio = this.hp / this.hpMax;
      const want = ratio < 0.33 ? 3 : ratio < 0.66 ? 2 : 1;
      if (want > this.phase && this.state !== 'phase') {
        this.phase = want;
        this.state = 'phase';
        this.stateT = 1.1;
        this.invuln = 1.1;
        game.clearEnemyBullets();
        FX.ring(this.x, this.y - 60, 20, 260, '#ff3d5e', 0.8, 5);
        FX.flash('white');
        FX.shake(12, 0.7);
        G.Audio.play('boss');
        game.toast(want === 2 ? '阶段 2 · 报表开始堆积' : '阶段 3 · 死亡线已过', 'pink');
        game.hudBossPhase(want);
      }

      if (this.state === 'intro') {
        this.stateT -= dt;
        if (this.stateT <= 0 && !this.introDone) {
          this.introDone = true;
          this.state = 'idle';
          this.stateT = 0.8;
          this.chooseAttack();
        }
        return;
      }
      if (this.state === 'phase') {
        this.stateT -= dt;
        if (this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 0.6;
        }
        return;
      }
      if (this.state === 'idle') {
        // drift
        this.stateT -= dt;
        this.x = U.lerp(this.x, this.targetX, Math.min(1, dt * 1.6));
        this.y = U.lerp(this.y, 185 + Math.sin(this.t * 0.9) * 14, Math.min(1, dt * 1.2));
        if (Math.abs(this.x - this.targetX) < 8 && this.stateT <= 0) this.chooseAttack();
        if (Math.random() < dt * 0.5) this.targetX = U.clamp(p.x + U.rand(-180, 180), 190, U.W - 190);
        return;
      }
      if (this.state === 'attack') {
        this.attackT += dt;
        this.updateAttack(dt, game, p);
        return;
      }
      if (this.state === 'recover') {
        this.stateT -= dt;
        this.x = U.lerp(this.x, this.targetX, Math.min(1, dt * 1.6));
        if (this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 0.7;
          this.targetX = U.clamp(p.x + U.rand(-200, 200), 190, U.W - 190);
        }
      }

      // contact
      if (this.touchCd <= 0 && U.dist(this.x, this.y - 40, p.x, p.y - 24) < 74) {
        if (p.takeDamage(16, { source: 'boss' })) this.touchCd = 1.2;
      }
    }

    chooseAttack() {
      const options1 = ['spread', 'summon', 'rings'];
      const options2 = ['spread', 'sweep', 'summon', 'rings'];
      const options3 = ['spread', 'sweep', 'rings', 'slam', 'summon'];
      const pool = this.phase === 1 ? options1 : this.phase === 2 ? options2 : options3;
      let pick = U.pick(pool);
      if (pick === this.nextAttack) pick = U.pick(pool);
      this.nextAttack = pick;
      this.startAttack(pick);
    }

    startAttack(name) {
      this.state = 'attack';
      this.attackT = 0;
      this.attack = name;
      this.attackFlags = {};
      this.game.hudBossPhase(this.phase);
      if (name === 'sweep') {
        const p = this.game.player;
        const base = Math.atan2(p.y - 24 - (this.y - 30), p.x - this.x);
        this.sweep = { a0: base - 1.0, a1: base + 1.2, dir: Math.random() < 0.5 ? 1 : -1, tick: 0 };
      }
    }

    updateAttack(dt, game, p) {
      const a = this.attackT;
      const player = p;
      switch (this.attack) {
        case 'spread': {
          this.x = U.lerp(this.x, this.targetX, Math.min(1, dt * 2));
          if (a > 0.65 && !this.attackFlags.fired1) {
            this.attackFlags.fired1 = true;
            this.fireFan(9, 0.5, 240);
            G.Audio.play('shoot2');
          }
          if (a > 1.05 && !this.attackFlags.fired2) {
            this.attackFlags.fired2 = true;
            this.fireFan(11, 0.7, 220);
          }
          if (a > 1.45 && !this.attackFlags.fired3) {
            this.attackFlags.fired3 = true;
            this.fireFan(13, 0.9, 200);
          }
          if (a > 1.9) this.endAttack();
          break;
        }
        case 'summon': {
          if (a > 0.9 && !this.attackFlags.fired1) {
            this.attackFlags.fired1 = true;
            for (let i = 0; i < 4; i++) {
              const ang = (i / 4) * TAU;
              const sp = game.findSpawnPoint(this.x + Math.cos(ang) * 150, this.y + Math.sin(ang) * 110);
              game.spawnEnemy(U.pick(['paper', 'zombie', 'printer']), sp.x, sp.y, { hpMul: 0.85, spawnFx: true });
            }
            FX.ring(this.x, this.y - 40, 20, 180, '#ffd24a', 0.6, 3);
            G.Audio.play('spawn');
          }
          if (a > 1.6) this.endAttack();
          break;
        }
        case 'rings': {
          this.x = U.lerp(this.x, U.W / 2, Math.min(1, dt * 2));
          if (a > 0.7 && !this.attackFlags.fired1) {
            this.attackFlags.fired1 = true;
            this.fireRing(18, 150, 0);
            G.Audio.play('shoot2');
          }
          if (a > 1.05 && !this.attackFlags.fired2) {
            this.attackFlags.fired2 = true;
            this.fireRing(18, 175, Math.PI / 18);
          }
          if (a > 1.45 && !this.attackFlags.fired3) {
            this.attackFlags.fired3 = true;
            this.fireRing(20, 195, Math.PI / 20);
          }
          if (a > 1.9) this.endAttack();
          break;
        }
        case 'sweep': {
          this.x = U.lerp(this.x, U.W / 2, Math.min(1, dt * 2));
          const s = this.sweep;
          if (a < 0.85) {
            // telegraph line rotates to start
          } else if (a < 2.4) {
            const k = (a - 0.85) / 1.55;
            const ang = U.lerp(s.a0, s.a1, U.easeOutCubic(k));
            this.sweepAng = ang;
            s.tick -= dt;
            if (s.tick <= 0) {
              s.tick = 0.12;
              const bx = this.x, by = this.y - 30;
              const ex = bx + Math.cos(ang) * 900;
              const ey = by + Math.sin(ang) * 900;
              if (U.segCircle(bx, by, ex, ey, player.x, player.y - 24, 15)) player.takeDamage(11, { source: 'sweep' });
              FX.spark(bx + Math.cos(ang) * 300, by + Math.sin(ang) * 300, ang + Math.PI, 40, '#ff3d5e', { life: 0.2 });
            }
            if (Math.random() < 0.6) {
              FX.add({ type: 'spark', x: this.x + Math.cos(ang) * U.rand(80, 700), y: this.y - 30 + Math.sin(ang) * U.rand(80, 700), vx: Math.cos(ang + Math.PI) * 80, vy: Math.sin(ang + Math.PI) * 80, color: '#ff8a6a', size: U.rand(1, 2.4), life: 0.25, drag: 0.9, glow: true });
            }
            G.Audio.startLaser();
          } else {
            G.Audio.stopLaser();
          }
          if (a > 2.55) { G.Audio.stopLaser(); this.endAttack(); }
          break;
        }
        case 'slam': {
          if (a > 0.6 && !this.attackFlags.zones) {
            this.attackFlags.zones = true;
            game.bossSlamZones(5);
          }
          if (a > 1.4) this.endAttack();
          break;
        }
      }
    }

    fireFan(n, arc, speed) {
      const base = Math.atan2(this.game.player.y - 24 - (this.y - 40), this.game.player.x - this.x);
      for (let i = 0; i < n; i++) {
        const a = base + (i / (n - 1) - 0.5) * arc;
        this.game.spawnBullet({
          x: this.x, y: this.y - 50, ang: a, speed, damage: 10,
          kind: 'report', color: '#ff6a4d', r: 6, owner: 'boss', life: 4,
        });
      }
      FX.ring(this.x, this.y - 50, 10, 70, '#ff3d5e', 0.25, 2);
    }

    fireRing(n, speed, offset) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + offset;
        this.game.spawnBullet({
          x: this.x, y: this.y - 40, ang: a, speed, damage: 9,
          kind: 'report', color: '#ff8a5e', r: 5, owner: 'boss', life: 5,
        });
      }
    }

    endAttack() {
      G.Audio.stopLaser();
      this.state = 'recover';
      this.stateT = this.phase === 3 ? 0.55 : 0.85;
      this.attack = null;
    }

    takeDamage(dmg, opts) {
      opts = opts || {};
      if (this.dead) return 0;
      if (this.invuln > 0) {
        if (!opts.softHit) FX.text(this.x + U.rand(-20, 20), this.y - 100, 'IMMUNE', '#8ea4c2', { scale: 1.4, life: 0.4 });
        return 0;
      }
      let final = Math.max(0, Number.isFinite(dmg) ? dmg : 0);
      // armored sides
      if (this.phase === 2) final *= 0.92;
      if (!(final > 0)) return 0;
      const before = this.hp;
      this.hp -= final;
      this.hitFlash = opts.softHit ? Math.min(0.45, this.hitFlash + 0.25) : 1;
      if (!opts.softHit) FX.hit(opts.x || this.x, opts.y || this.y - 80, opts.angle || 0, '#ffd9a8', opts.crit);
      if (this.hp <= 0) this.game.bossDefeated(this);
      return Math.max(0, Math.min(before, final));
    }

    draw(ctx, t) {
      const o = {
        t: this.t,
        phase: this.phase,
        flash: this.hitFlash,
        eyeDir: this.eyeDir,
      };
      SP.drawBoss(ctx, this.x, this.y, o);
      // telegraphs
      if (this.state === 'attack') {
        const a = this.attackT;
        if (this.attack === 'spread' && a < 0.7) {
          this.drawFanWarning(ctx, 0.7 - a);
        } else if (this.attack === 'rings' && a < 0.75) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,61,94,' + (0.35 + Math.sin(t * 20) * 0.15) + ')';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 6]);
          ctx.beginPath(); ctx.arc(this.x, this.y - 30, 70 + a * 120, 0, TAU); ctx.stroke();
          ctx.restore();
        } else if (this.attack === 'sweep') {
          const s = this.sweep;
          let ang;
          if (a < 0.85) ang = s.a0;
          else ang = U.lerp(s.a0, s.a1, U.easeOutCubic(Math.min(1, (a - 0.85) / 1.55)));
          ctx.save();
          ctx.translate(this.x, this.y - 30);
          ctx.rotate(ang);
          ctx.globalAlpha = a < 0.85 ? 0.35 + Math.sin(t * 24) * 0.15 : 0.9;
          ctx.fillStyle = a < 0.85 ? 'rgba(255,61,94,0.18)' : 'rgba(255,255,255,0.9)';
          ctx.fillRect(0, -4, 900, 8);
          ctx.fillStyle = 'rgba(255,61,94,0.8)';
          ctx.fillRect(0, -2, 900, 4);
          ctx.restore();
          if (a >= 0.85 && a < 2.4) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(this.x, this.y - 30);
            ctx.rotate(ang);
            const grad = ctx.createLinearGradient(0, 0, 900, 0);
            grad.addColorStop(0, 'rgba(255,90,80,0.9)');
            grad.addColorStop(1, 'rgba(255,60,60,0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 9;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(900, 0); ctx.stroke();
            ctx.restore();
          }
        } else if (this.attack === 'slam') {
          // zones drawn by game
        }
      }
      if (this.hitFlash > 0.1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        U.glow(ctx, this.x, this.y - 70, 100, '#ff3d5e', this.hitFlash * 0.08);
        ctx.restore();
      }
      // phase glow
      if (this.phase >= 2) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        U.glow(ctx, this.x, this.y - 70, 150, this.phase === 3 ? '#ff2d3d' : '#ff7a2d', 0.08 + Math.sin(t * 3) * 0.02);
        ctx.restore();
      }
      if (this.markT > 0) drawMark(ctx, this.x, this.y - 168, t);
      if (this.stunT > 0) drawStun(ctx, this.x, this.y - 180, t);
    }

    drawFanWarning(ctx, k) {
      const base = U.angle(this.x, this.y - 40, this.game.player.x, this.game.player.y - 24);
      ctx.save();
      ctx.translate(this.x, this.y - 40);
      ctx.rotate(base);
      ctx.fillStyle = 'rgba(255,60,70,' + (0.08 + (1 - k) * 0.12) + ')';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 520, -0.55, 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,90,90,' + (0.3 + Math.sin(k * 30) * 0.1) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 520, -0.55, 0.55); ctx.stroke();
      ctx.restore();
    }
  }
  G.Boss = Boss;

  // ============================================================
  // PICKUP
  // ============================================================
  class Pickup {
    constructor(kind, x, y, value, opt) {
      this.kind = kind;
      this.x = x; this.y = y;
      this.vx = (Math.random() - 0.5) * 90;
      this.vy = -U.rand(30, 100);
      this.value = value || 0;
      this.r = kind === 'xp' ? 9 : 8;
      this.life = kind === 'coin' ? 24 : 18;
      this.t = Math.random() * 10;
      this.attract = false;
      this.dead = false;
      this.opt = opt || {};
    }

    update(dt, game) {
      this.t += dt;
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      const p = game.player;
      const dx = p.x - this.x, dy = p.y - 22 - this.y;
      const d = Math.hypot(dx, dy);
      const range = game.run.stats.pickup * (this.kind === 'xp' ? 1 : 0.9);
      if (game.run.stats.magnetAll || d < range) this.attract = true;
      if (this.attract) {
        const sp = U.clamp(900 - d * 0.4, 340, 900);
        this.x += (dx / (d || 1)) * sp * dt;
        this.y += (dy / (d || 1)) * sp * dt;
        if (d < 18) this.collect(game);
        return;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += 380 * dt;
      this.vx *= Math.pow(0.94, dt * 60);
      const floorY = this.y + 12;
      if (floorY > game.world.bounds.y + game.world.bounds.h - 12) {
        this.y = game.world.bounds.y + game.world.bounds.h - 24;
        this.vy *= -0.35;
        if (Math.abs(this.vy) < 20) this.vy = 0;
      }
      const b = game.world.bounds;
      this.x = U.clamp(this.x, b.x + 14, b.x + b.w - 14);
    }

    collect(game) {
      if (this.dead) return;
      this.dead = true;
      if (this.kind === 'xp') {
        game.addXp(this.value);
        G.Audio.play('xp', { pitch: 0.9 + Math.random() * 0.4 });
        FX.spark(this.x, this.y, -Math.PI / 2, 60, '#57f4ff', { life: 0.3 });
      } else if (this.kind === 'coin') {
        game.addGold(this.value);
        G.Audio.play('coin');
        FX.text(this.x, this.y - 8, '+' + this.value, '#ffd24a', { scale: 1.4, life: 0.5 });
      } else if (this.kind === 'heart') {
        game.healPlayer(this.value);
        G.Audio.play('heal');
      } else if (this.kind === 'shield') {
        game.addShield(this.value);
        G.Audio.play('pickup');
      } else if (this.kind === 'magnet') {
        game.run.stats.pickup += 20;
        game.toast('磁力增强：拾取范围 +20', 'gold');
      } else if (this.kind === 'key') {
        game.onKeyPickup();
      }
    }

    draw(ctx) {
      ctx.save();
      const blink = this.life < 4 && Math.floor(this.life * 8) % 2 === 0;
      if (blink) ctx.globalAlpha = 0.4;
      SP.drawPickup(ctx, this.kind, this.x, this.y, this.t);
      ctx.restore();
    }
  }
  G.Pickup = Pickup;

  // ============================================================
  // TURRET — Ama's HOTFIX terminal
  // ============================================================
  class Turret {
    constructor(game, x, y) {
      this.game = game;
      this.x = x;
      this.y = y;
      this.r = 14;
      this.t = Math.random() * 10;
      this.life = 8;
      this.maxLife = 8;
      this.fireCd = 0.28;
      this.dead = false;
      this.beamT = 0;
    }

    update(dt, game) {
      if (this.dead) return;
      this.t += dt;
      this.life -= dt;
      this.fireCd -= dt;
      this.beamT = Math.max(0, this.beamT - dt);
      if (this.life <= 0) {
        this.dead = true;
        FX.burst(this.x, this.y - 18, '#57f4ff', 14, { speed: 180 });
        FX.ring(this.x, this.y - 18, 4, 36, '#57f4ff', 0.35, 2);
        G.Audio.play('die', { pitch: 1.6 });
        return;
      }
      if (this.fireCd <= 0) {
        const target = game.nearestEnemy(this.x, this.y - 22, 470);
        if (target) {
          const sx = this.x;
          const sy = this.y - 28;
          const ang = Math.atan2(target.y - 16 - sy, target.x - sx);
          const damage = (7 + game.run.level * 1.2) * game.run.stats.skillPower * game.getDamageMul();
          const speed = 760;
          game.bullets.push(new G.Bullet({
            x: sx + Math.cos(ang) * 10, y: sy + Math.sin(ang) * 10,
            vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
            r: 4.2, damage, critChance: game.getCrit(), critMult: game.run.stats.critMult,
            camp: 'player', color: '#57f4ff', kind: 'hotfix',
            life: 1.0, pierce: 0, knock: 14, ang,
          }));
          this.beamT = 0.08;
          FX.add({ type: 'flash', x: sx + Math.cos(ang) * 10, y: sy + Math.sin(ang) * 10, size: 10, life: 0.06, color: '#57f4ff' });
          G.Audio.play('turretShot');
          this.fireCd = 0.34 / Math.max(0.7, game.run.stats.fireRate);
        } else {
          this.fireCd = 0.12;
        }
      }
      if (Math.random() < dt * 1.6) {
        FX.add({ type: 'smoke', x: this.x + U.rand(-7, 7), y: this.y - 30, vx: U.rand(-5, 5), vy: -U.rand(6, 16), size: U.rand(2, 4), life: 0.7, color: 'rgba(80,200,230,0.12)' });
      }
    }

    draw(ctx, t) {
      SP.drawTurret(ctx, this.x, this.y, {
        t: this.t,
        life: this.life,
        maxLife: this.maxLife,
        beamT: this.beamT,
        flash: this.life < 2 && Math.floor(this.life * 8) % 2 === 0,
      });
    }
  }
  G.Turret = Turret;

  // ============================================================
  // SHOCKWAVE / NOVA
  // ============================================================
  class Shockwave {
    constructor(x, y, opt) {
      this.x = x; this.y = y;
      this.r = 20;
      this.maxR = opt.maxR || 210;
      this.speed = opt.speed || 620;
      this.color = opt.color || '#57f4ff';
      this.damage = opt.damage || 0;
      this.hitSet = [];
      this.dead = false;
      this.clears = !!opt.clears;
      this.width = opt.width || 4;
      this.life = 0.5;
      this.knock = opt.knock || 320;
    }

    update(dt, game) {
      this.r += this.speed * dt;
      if (this.r > this.maxR) this.dead = true;
      if (this.clears && !this.cleared) {
        this.cleared = true;
        game.clearEnemyBullets(this.x, this.y, this.maxR * 0.85);
      }
      for (const e of game.enemies) {
        if (e.dead || this.hitSet.indexOf(e.id) >= 0) continue;
        if (U.dist(this.x, this.y, e.x, e.y - 14) < this.r + e.r) {
          this.hitSet.push(e.id);
          const a = Math.atan2(e.y - 14 - this.y, e.x - this.x);
          game.damageEnemy(e, this.damage, { angle: a, knock: this.knock, x: e.x, y: e.y - 14 });
        }
      }
      const boss = game.boss;
      if (boss && !boss.dead && this.hitSet.indexOf('boss') < 0 && U.dist(this.x, this.y, boss.x, boss.y - 60) < this.r + 70) {
        this.hitSet.push('boss');
        game.damageEnemy(boss, this.damage, { x: boss.x, y: boss.y - 80 });
      }
    }

    draw(ctx) {
      const k = this.r / this.maxR;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.lineWidth = this.width * (1 - k * 0.5);
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - 18, this.r, this.r * 0.55, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.28;
      ctx.lineWidth = this.width * 3;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - 18, this.r * 0.94, this.r * 0.52, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
  G.Shockwave = Shockwave;

  // ============================================================
  // BOSS SLAM ZONES
  // ============================================================
  class SlamZone {
    constructor(x, y, r, delay) {
      this.x = x; this.y = y; this.r = r || 70;
      this.delay = delay || 0.9;
      this.t = 0;
      this.exploded = false;
      this.dead = false;
      this.game = null;
    }
    update(dt, game) {
      this.t += dt;
      if (!this.exploded && this.t >= this.delay) {
        this.exploded = true;
        game.explosion(this.x, this.y, this.r, 26, '#ff3d5e', 'boss');
        FX.ring(this.x, this.y, 6, this.r * 1.2, '#ff6a4d', 0.4, 4);
        FX.shake(6, 0.3);
        G.Audio.play('explode');
        this.dead = true;
      }
    }
    draw(ctx) {
      const k = Math.min(1, this.t / this.delay);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ff8b77';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,61,94,0.2)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * k, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#fff1bd';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.stroke();
      ctx.restore();
    }
  }
  G.SlamZone = SlamZone;
})();
