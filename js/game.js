/* ============================================================
   game.js — run loop, rooms, input, combat glue, save hooks
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;
  const FX = G.FX;
  const SP = G.Sprites;
  const D = G.DATA;
  const W = 960, H = 540;
  const TAU = Math.PI * 2;

  class Game {
    get state() { return this._state; }
    set state(value) {
      this._state = value;
      if (value !== 'play' && value !== 'cleared' && this.input) this.clearCombatInput();
    }

    canAct() {
      return (this.state === 'play' || this.state === 'cleared') && this.player && !this.player.dead && !(G.UI && G.UI.modalOpen);
    }

    clearCombatInput() {
      this.input.keys = {};
      this.input.firing = false;
      this.input.clickFire = false;
      this.input.attackBuffer = 0;
      this.input.actions = {};
      this.input.touch.x = this.input.touch.y = 0;
      this.interactTarget = null;
      if (this.player) {
        if (this.player.stopBeam) this.player.stopBeam();
        else this.player.beam = null;
      }
      G.Audio.stopLaser();
      const knob = document.getElementById('stick-knob');
      if (knob) knob.style.transform = 'translate(0,0)';
    }

    queueAction(name) {
      if (!this.canAct()) return;
      this.input.actions[name] = 0.16;
    }

    consumeActions(dt) {
      if (!this.canAct()) return;
      const p = this.player;
      const ready = { dash: p.dashCharge > 0 && p.dashT <= 0, skill: p.skillCd <= 0, skill2: p.skill2Cd <= 0, interact: !!this.interactTarget };
      const methods = { dash: 'tryDash', skill: 'trySkill', skill2: 'trySkill2' };
      for (const name of Object.keys(this.input.actions)) {
        if (!this.canAct()) break;
        if (ready[name]) {
          delete this.input.actions[name];
          if (name === 'interact') this.tryInteract();
          else p[methods[name]]();
        } else {
          this.input.actions[name] -= dt;
          if (this.input.actions[name] <= 0) delete this.input.actions[name];
        }
      }
    }

    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.state = 'boot';
      this.scale = 1;
      this.dpr = 1;
      this.time = 0;
      this.last = 0;
      this.acc = 0;
      this.hudT = 0;
      this.run = null;
      this.player = null;
      this.world = null;
      this.enemies = [];
      this.bullets = [];
      this.pickups = [];
      this.shockwaves = [];
      this.slamZones = [];
      this.afterimages = [];
      this.deadline = null;
      this.turrets = [];
      this.boss = null;
      this.menuWorld = null;
      this.timers = [];
      this.hitstopT = 0;
      this.slowT = 0;
      this.pendingLevels = 0;
      this.choiceOpen = false;
      this.interactTarget = null;
      this.interactLabel = '';
      this.hpDebounce = 0;
      this.mouseX = W / 2;
      this.mouseY = H / 2;
      this.menuT = 0;
      this.firstRun = true;
      this.aimTrail = [];
      this.settings = G.Save.getSettings();
      this.input = {
        keys: {},
        aimX: W / 2, aimY: H / 2,
        mouseMovedRecently: false,
        mouseIdleT: 0,
        usingTouch: false,
        touch: { x: 0, y: 0 },
        firing: false,
        clickFire: false,
        attackBuffer: 0,
        actions: {},
      };
      this.bindEvents();
      this.resize();
    }

    // ============================================================
    // boot / menu
    // ============================================================
    init() {
      this.menuWorld = new W_World(this, 0, 'battle');
      this.menuWorld.phase = 'frozen';
      this.state = 'menu';
      this.applySettings();
      G.UI.init(this);
      G.Audio.setMood('menu');
      this.render();
      requestAnimationFrame((ts) => this.loop(ts));
    }

    applySettings() {
      G.Audio.setMusic(this.settings.music);
      G.Audio.setSfx(this.settings.sfx);
      G.Audio.setMuted(!!this.settings.muted);
      document.body.classList.toggle('no-crt', !this.settings.crt);
      const g = document.getElementById('sound-glyph');
      if (g) g.classList.toggle('is-muted', !!this.settings.muted);
      const btn = document.getElementById('btn-sound');
      if (btn) btn.classList.toggle('muted', !!this.settings.muted);
    }

    bindEvents() {
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('keydown', (e) => this.onKeyDown(e));
      window.addEventListener('keyup', (e) => { this.input.keys[e.key.toLowerCase()] = false; });
      window.addEventListener('blur', () => {
        this.clearCombatInput();
        if (this.state === 'play' || this.state === 'cleared') this.pause();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { this.clearCombatInput(); this.pause(); this.acc = 0; }
      });
      const stage = document.getElementById('stage');
      stage.addEventListener('mousemove', (e) => {
        const r = stage.getBoundingClientRect();
        this.mouseX = ((e.clientX - r.left) / r.width) * W;
        this.mouseY = ((e.clientY - r.top) / r.height) * H;
        this.input.mouseMovedRecently = true;
        this.input.mouseIdleT = 0;
        this.input.usingTouch = false;
      });
      stage.addEventListener('mousedown', (e) => {
        if (e.button === 0 && e.target === this.canvas && this.canAct()) {
          this.input.clickFire = true;
          this.input.firing = true;
          this.input.attackBuffer = 0.16;
        }
      });
      document.addEventListener('mouseup', () => { this.input.firing = false; if (this.player && this.player.stopBeam) this.player.stopBeam(); });
      stage.addEventListener('contextmenu', (e) => e.preventDefault());
      this.bindTouch(stage);
      document.addEventListener('pointerdown', () => G.Audio.init(), { once: true });
      document.addEventListener('keydown', () => G.Audio.init(), { once: true });
    }

    bindTouch(stage) {
      const isTouch = ('ontouchstart' in window) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      const layer = document.getElementById('touch-layer');
      if (isTouch) {
        document.body.classList.add('touch-mode');
        if (layer) layer.hidden = false;
        const pause = document.getElementById('touch-pause');
        if (pause) pause.addEventListener('touchstart', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.input.usingTouch = true;
          if (this.state === 'paused') this.resume();
          else this.pause();
        }, { passive: false });
      }
      const stick = document.getElementById('stick-base');
      const knob = document.getElementById('stick-knob');
      if (!stick) return;
      let sid = null, ox = 0, oy = 0;
      const upd = (cx, cy) => {
        const r = 70;
        let dx = cx - ox, dy = cy - oy;
        const d = Math.hypot(dx, dy);
        if (d > r) { dx = dx / d * r; dy = dy / d * r; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        const nx = dx / r, ny = dy / r;
        const dead = 0.12;
        this.input.touch.x = Math.abs(nx) < dead ? 0 : nx;
        this.input.touch.y = Math.abs(ny) < dead ? 0 : ny;
      };
      stick.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!this.canAct()) return;
        this.input.usingTouch = true;
        const t = e.changedTouches[0];
        const r = stick.getBoundingClientRect();
        ox = r.left + r.width / 2; oy = r.top + r.height / 2;
        sid = t.identifier;
        upd(t.clientX, t.clientY);
      }, { passive: false });
      stick.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (sid == null || !this.canAct()) return;
        for (const t of e.changedTouches) if (t.identifier === sid) upd(t.clientX, t.clientY);
      }, { passive: false });
      const end = (e) => {
        for (const t of e.changedTouches) if (t.identifier === sid) {
          sid = null;
          this.input.touch.x = 0; this.input.touch.y = 0;
          knob.style.transform = 'translate(0,0)';
        }
      };
      stick.addEventListener('touchend', end);
      stick.addEventListener('touchcancel', end);
      const dash = document.getElementById('touch-dash');
      const skill = document.getElementById('touch-skill');
      const skill2 = document.getElementById('touch-skill2');
      for (const [el, action] of [[dash, 'dash'], [skill, 'skill'], [skill2, 'skill2'], [document.getElementById('touch-interact'), 'interact']]) {
        if (el) el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.input.usingTouch = true; this.queueAction(action); }, { passive: false });
      }
      const fire = document.getElementById('touch-fire');
      if (fire) {
        fire.addEventListener('pointerdown', (e) => {
          e.preventDefault(); e.stopPropagation();
          if (!this.canAct()) return;
          fire.setPointerCapture(e.pointerId);
          this.input.usingTouch = true;
          this.input.firing = true;
          this.input.attackBuffer = 0.16;
        });
        const release = () => { this.input.firing = false; if (this.player && this.player.stopBeam) this.player.stopBeam(); };
        fire.addEventListener('pointerup', release);
        fire.addEventListener('pointercancel', release);
        fire.addEventListener('lostpointercapture', release);
      }
    }

    resize() {
      const stage = document.getElementById('stage');
      if (!stage) return;
      const w = stage.clientWidth;
      const scale = U.clamp(w / W, 1, 2.6);
      const pw = Math.round(W * scale), ph = Math.round(H * scale);
      if (this.canvas.width !== pw || this.canvas.height !== ph) {
        this.canvas.width = pw;
        this.canvas.height = ph;
      }
      this.scale = pw / W;
      this.ctx.imageSmoothingEnabled = false;
    }

    // ============================================================
    // input
    // ============================================================
    onKeyDown(e) {
      const k = e.key.toLowerCase();
      if ([' ', 'tab', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) e.preventDefault();
      if (G.UI && G.UI.modalOpen) {
        if (k === 'escape') G.UI.closeTopModal();
        return;
      }
      if (e.repeat) return;
      this.input.keys[k] = true;
      if (k === 'm') {
        this.settings.muted = G.Audio.toggleMute();
        G.Save.saveSettings(this.settings);
        this.applySettings();
        return;
      }
      if (this.state === 'play' || this.state === 'cleared') {
        if (k === ' ') this.queueAction('dash');
        if (k === 'q') this.queueAction('skill');
        if (k === 'r') this.queueAction('skill2');
        if (k === 'e' || k === 'f') this.queueAction('interact');
        if (k === 'escape') this.pause();
        if (k === 'tab') this.togglePauseBuild();
      } else if (this.state === 'paused') {
        if (k === 'escape') this.resume();
      } else if (this.state === 'levelup' || this.state === 'event') {
        if (['1', '2', '3', '4'].indexOf(k) >= 0) G.UI.pickChoice(parseInt(k, 10) - 1);
        if (k === 'escape' && this.state === 'event') {
          G.UI.closeChoice();
          this.choiceOpen = false;
          this.state = 'play';
        }
      } else if (this.state === 'menu') {
        if (k === 'enter') G.UI.startFromMenu();
      } else if (this.state === 'gameover' || this.state === 'victory') {
        if (k === 'enter' || k === 'r') G.UI.restartFromOver();
      }
    }

    tryInteract() {
      if (!this.canAct()) return;
      this.updateInteractions();
      if (!this.interactTarget) return;
      const t = this.interactTarget;
      if (t.type === 'door') {
        this.enterDoor(t.data);
      } else if (t.type === 'chest') {
        this.openChest(t.data);
      } else if (t.type === 'shop') {
        this.openShop(t.data);
      } else if (t.type === 'terminal') {
        G.Exploration.interact(this, t);
      }
    }

    pause() {
      if (this.state !== 'play' && this.state !== 'cleared') return;
      this.prevState = this.state;
      this.state = 'paused';
      this.input.firing = false;
      G.Audio.setMusic(this.settings.music * 0.35);
      G.UI.showPause();
      G.Audio.play('ui');
    }

    resume() {
      if (this.state !== 'paused') return;
      this.state = this.prevState || 'play';
      G.Audio.setMusic(this.settings.music);
      G.UI.hidePause();
    }

    togglePauseBuild() {
      if (this.state === 'paused') this.resume();
      else this.pause();
      G.UI.updatePauseBuild();
    }

    // ============================================================
    // run lifecycle
    // ============================================================
    startRun(charId, weaponId, retry, mode) {
      const char = D.characters.find((c) => c.id === charId) || D.characters[0];
      const stats = D.makeStats();
      stats.crit += char.crit;
      const run = {
        character: char.id,
        weapon: weaponId || char.defaultWeapon,
        hp: char.hp,
        maxHp: char.hp,
        speed: char.speed,
        shield: 0,
        stats,
        gold: 0,
        level: 1,
        xp: 0,
        xpNext: 26,
        kills: 0,
        damage: 0,
        taken: 0,
        combo: 0,
        comboT: 0,
        bestCombo: 0,
        roomIndex: 0,
        roomKind: 'battle',
        roomsCleared: 0,
        time: 0,
        weaponLevel: 1,
        weaponName: D.weapons[weaponId || char.defaultWeapon].name,
        upgrades: [],
        upgradeCounts: {},
        relics: [],
        rerolls: 0,
        score: 0,
        destroyed: 0,
        firstBreak: false,
        victory: false,
        seenEnemies: [],
        curseNextRoom: 0,
        curseNextRoomSpeed: 0,
        enemyHpBonus: 0,
        lastDoor: null,
      };
      run.hp = run.maxHp;
      // meta training
      for (const tr of D.training) {
        const lv = (G.Save.data.training[tr.id] || 0);
        if (lv > 0) tr.apply(run, lv);
      }
      // character-specific active skill cooldowns
      run.skillId = char.skill.id;
      run.skill2Id = char.skill2.id;
      run.stats.skillCd = char.skill.cd;
      run.stats.skill2Cd = char.skill2.cd;
      run.hp = run.maxHp;
      this.run = run;
      G.Modes.init(run, mode);
      G.UI.modalOpen = false;
      this.clearCombatInput();
      this.player = null;
      this.enemies = [];
      this.bullets = [];
      this.pickups = [];
      this.shockwaves = [];
      this.slamZones = [];
      this.afterimages = [];
      this.deadline = null;
      this.turrets = [];
      this.boss = null;
      this.timers = [];
      this.pendingLevels = 0;
      this.choiceOpen = false;
      this.firstRun = false;
      this.savedRun = false;
      this.runTime = 0;
      this.hitstopT = 0;
      this.slowT = 0;
      G.Save.markSeen('weapons', run.weapon);
      G.Audio.init();
      const firstRoom = G.Modes.firstRoom(run);
      this.enterRoom(firstRoom, firstRoom === 6 ? 'boss' : 'battle');
      G.UI.showHud();
      G.UI.showRoomIntro(firstRoom);
      G.Audio.setMood(firstRoom === 6 ? 'boss' : 'battle');
      G.UI.toast('按住左键开火/聚焦 · 空格闪避 · Q/R 技能', 'gold');
      G.Audio.play('door');
    }

    enterRoom(index, kind) {
      const run = this.run;
      this.clearCombatInput();
      const previous = this.player;
      run.roomIndex = index;
      run.roomKind = kind;
      this.enemies = [];
      this.bullets = [];
      this.pickups = [];
      this.shockwaves = [];
      this.slamZones = [];
      this.afterimages = [];
      this.deadline = null;
      this.turrets = [];
      this.boss = null;
      this.timers = [];
      this.choiceOpen = false;
      this.interactTarget = null;
      FX.clear();
      const world = new W_World(this, index, kind);
      this.world = world;
      const p = new G.Player(this);
      // Resources/cooldowns belong to the run; position and attack animations to the room.
      if (previous) for (const key of ['skillCd', 'skill2Cd', 'dashCharge', 'dashRecharge', 'dashCd', 'laserHeat', 'laserOverheated', 'shootCd', 'meleeCd']) {
        if (previous[key] != null) p[key] = previous[key];
      }
      this.player = p;
      this.state = 'play';
      G.UI.hideChoice();
      G.UI.showHud();
      G.UI.updateHud(this, true);
      G.UI.hideBoss();
      G.Audio.stopLaser();
      if (index >= 6 || kind === 'boss') {
        this.startBossFight(world);
      } else {
        world.start();
      }
      // room clear check for empty rest rooms
      this.hudT = 0;
    }

    startBossFight(world) {
      world.phase = 'boss';
      this.boss = new G.Boss(this);
      this.boss.x = 480;
      this.boss.y = 190;
      G.UI.showBoss(this.boss);
      G.UI.hudBoss();
      G.UI.combatToast('周报魔王 · KPI-0');
      G.UI.bossLine('KPI-0', '公司不养闲人。加班费，是给有绩效的人的。', 2.7);
      this.after(2.4, () => G.UI.bossLine('阿比盖尔', '我只想拿回我的加班费。', 2.3));
      this.after(4.6, () => G.UI.bossLine('KPI-0', '那就用你的周报来换。', 2.3));
      // rooftop supply drop — heal half before the final fight
      const run = this.run;
      if (run) G.Modes.bossSetup(this);
      G.Audio.setMood('boss');
      G.Audio.play('boss');
      FX.flash('white');
      FX.shake(8, 1.2);
      const p = this.player;
      p.x = 480; p.y = 452;
      this.toast('红圈出现就闪。它只会三件事：发周报、盖章、让你加班。', 'pink');
    }

    roomCleared(world) {
      const run = this.run;
      run.roomsCleared++;
      const idx = run.roomIndex;
      const goldReward = 12 + idx * 4;
      this.addGold(goldReward);
      this.addXp(8 + idx * 3);
      if (run.stats.healOnRoom) this.healPlayer(run.stats.healOnRoom);
      this.healPlayer(run.maxHp * 0.06, true);
      G.Audio.play('levelup');
      FX.ring(this.player.x, this.player.y - 20, 10, 120, '#57f4ff', 0.6, 3);
      this.toast('房间清理完毕 · 获得 ¥' + goldReward, 'gold');
      if (run.roomIndex >= 2) G.Save.unlockCharacter('ama');
      const kind = run.roomKind;
      const isLast = idx >= D.rooms.length - 1;
      if (kind === 'elite') {
        this.after(0.9, () => this.grantRelicChoice());
      } else if (kind === 'treasure') {
        this.after(0.9, () => {
          world.addChest(480, 300);
          this.toast('资料室深处有个保险箱', 'gold');
        });
      } else if (kind === 'shop') {
        this.after(0.9, () => {
          world.addVending(480, 300);
          this.toast('自动贩卖机还在工作', 'pink');
        });
      } else if (kind === 'event') {
        this.after(1.1, () => this.openEvent());
      } else if (kind === 'rest') {
        this.after(0.5, () => {
          this.healPlayer(run.maxHp * 0.3);
          this.toast('你在吸烟区喘了口气 · 回复 30% 生命', 'gold');
        });
      }
      if (isLast) {
        this.after(1.4, () => {
          world.spawnBossDoor();
          this.toast('天台的门开了', 'pink');
        });
      } else {
        this.after(1.2, () => {
          if (world.doors.length) return;
          const types = D.rollDoors(run);
          world.spawnDoors(types);
          this.toast('选择一扇门继续深入', '');
        });
      }
    }

    enterDoor(door) {
      if (!door || this.state !== 'play' && this.state !== 'cleared') return;
      if (this.world.phase !== 'cleared') return;
      if (door.explorationLocked) return;
      const isBoss = door.type === 'boss';
      FX.flash('white');
      FX.ring(door.x, door.y - 30, 10, 100, door.color, 0.5, 3);
      FX.shake(4, 0.3);
      G.Audio.play('door');
      const nextKind = isBoss ? 'boss' : door.type;
      this.run.lastDoor = door.type;
      this.player.invuln = 2;
      this.state = 'fade';
      G.UI.fadeOut(0.32, () => {
        if (isBoss) {
          this.enterRoom(6, 'boss');
          G.UI.showRoomIntro(6);
        } else {
          this.enterRoom(this.run.roomIndex + 1, nextKind);
          G.UI.showRoomIntro(this.run.roomIndex);
        }
        G.UI.fadeIn(0.35);
      });
    }

    openChest(ob) {
      if (ob.opened) return;
      ob.opened = true;
      const run = this.run;
      const gold = 30 + U.randInt(10, 25);
      run.gold += gold;
      this.toast('保险箱：¥' + gold + ' 与一份绩效评估', 'gold');
      FX.burst(ob.x + ob.w / 2, ob.y + 10, '#ffd24a', 24, { speed: 260 });
      FX.ring(ob.x + ob.w / 2, ob.y + 10, 6, 90, '#ffd24a', 0.5, 3);
      G.Audio.play('coin');
      G.Audio.play('levelup');
      this.interactTarget = null;
      this.after(0.45, () => this.grantUpgradeChoice(['rare', 'epic', 'legend']));
    }

    openShop(ob) {
      G.Audio.play('ui2');
      this.openShopMenu(ob);
    }

    openEvent() {
      if (this.state !== 'play') return;
      const ev = U.pick(D.events);
      G.UI.showEvent(ev, this);
      this.state = 'event';
    }

    after(t, fn) {
      this.timers.push({ t, fn });
    }

    // ============================================================
    // combat helpers
    // ============================================================
    getDamageMul() {
      const st = this.run.stats;
      let mul = st.damage * st.wpnDamage;
      if (st.photoBonus) mul *= 1 + this.run.relics.length * 0.04;
      return mul;
    }

    getCrit() {
      return U.clamp(this.run.stats.crit, 0, 0.95);
    }

    resolveObstacles(x, y, r) {
      let px = x, py = y;
      const obs = this.world ? this.world.obstacles : [];
      for (let i = 0; i < 3; i++) {
        let hit = false;
        for (const o of obs) {
          if (o.solid === false || o.dead) continue;
          const res = U.resolveCircleRect(px, py, r, o);
          if (res) { px = res.x; py = res.y; hit = true; }
        }
        if (!hit) break;
      }
      return { x: px, y: py };
    }

    findSpawnPoint(px, py) {
      const b = this.world ? this.world.bounds : { x: 30, y: 104, w: 900, h: 404 };
      const player = this.player;
      for (let i = 0; i < 40; i++) {
        let x, y;
        if (px != null && i < 12) {
          x = px + U.rand(-40, 40);
          y = py + U.rand(-40, 40);
        } else {
          const side = (Math.random() * 4) | 0;
          if (side === 0) { x = U.rand(b.x + 40, b.x + b.w - 40); y = b.y + 20; }
          else if (side === 1) { x = U.rand(b.x + 40, b.x + b.w - 40); y = b.y + b.h - 40; }
          else if (side === 2) { x = b.x + 30; y = U.rand(b.y + 40, b.y + b.h - 40); }
          else { x = b.x + b.w - 30; y = U.rand(b.y + 40, b.y + b.h - 40); }
        }
        x = U.clamp(x, b.x + 20, b.x + b.w - 20);
        y = U.clamp(y, b.y + 20, b.y + b.h - 20);
        if (player && U.dist(x, y, player.x, player.y) < 170) continue;
        if (this.world && this.world.isBlocked(x, y, 20)) continue;
        return { x, y };
      }
      return { x: U.W / 2, y: 160 };
    }

    findSpawnPointNear(x, y) {
      return { x: U.clamp(x + U.rand(-60, 60), 50, 910), y: U.clamp(y + U.rand(-60, 60), 120, 500) };
    }

    nearestEnemy(x, y, maxDist) {
      let best = null;
      let bd = maxDist == null ? Infinity : maxDist;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = U.dist(x, y, e.x, e.y - (e.hitY || 14));
        if (d < bd) { bd = d; best = e; }
      }
      if (this.boss && !this.boss.dead) {
        const d = U.dist(x, y, this.boss.x, this.boss.y - 60);
        if (d < bd) { bd = d; best = this.boss; }
      }
      return best;
    }

    spawnEnemy(type, x, y, opt) {
      opt = opt || {};
      const dm = 1 + this.run.roomIndex * 0.055;
      const e = new G.Enemy(this, type, x, y, {
        hpMul: opt.hpMul || 1,
        dmgMul: dm,
        speedMul: opt.speedMul || 1,
      });
      this.enemies.push(e);
      G.Save.markSeen('enemies', type);
      if (opt.spawnFx) FX.ring(x, y, 2, 28, '#ff3d5e', 0.3, 2);
      return e;
    }

    spawnBullet(o) {
      const b = new G.Bullet({
        x: o.x, y: o.y,
        vx: Math.cos(o.ang) * o.speed,
        vy: Math.sin(o.ang) * o.speed,
        r: o.r || 5,
        damage: o.damage || 8,
        camp: o.camp || 'enemy',
        color: o.color || '#ff3d5e',
        kind: o.kind || 'paper',
        life: o.life || 4,
        pierce: 0,
        knock: 0,
        homing: o.homing || 0,
        ghost: o.ghost || false,
        owner: o.owner,
        ang: o.ang,
        spinSpeed: o.spinSpeed,
      });
      this.bullets.push(b);
      return b;
    }

    damageEnemy(enemy, base, opts) {
      opts = opts || {};
      if (!enemy || enemy.dead) return;
      let dmg = base;
      let crit = false;
      if (enemy.markT > 0) dmg *= 1 + (enemy.markAmp || 0.3);
      if (opts.critChance != null && Math.random() < opts.critChance) {
        crit = true;
        dmg *= opts.critMult || this.run.stats.critMult;
      }
      if (opts.source !== 'laser') dmg *= U.rand(0.94, 1.06);
      dmg = opts.source === 'laser' ? Math.max(0, dmg) : Math.max(1, Math.round(dmg * 10) / 10);
      const hpBefore = enemy.hp;
      enemy.takeDamage(dmg, {
        crit,
        angle: opts.angle || 0,
        knock: opts.knock || 0,
        x: opts.x, y: opts.y,
        softHit: opts.softHit,
      });
      const actual = Math.max(0, hpBefore - Math.max(0, enemy.hp));
      this.run.damage += actual;
      if (!opts.silentParticles) {
        FX.text(opts.x || enemy.x, (opts.y || enemy.y - 30) - 14, crit ? Math.round(dmg) + '!' : Math.round(dmg), crit ? '#ffd24a' : '#ffffff', { scale: crit ? 2.8 : 1.9, crit, life: crit ? 0.85 : 0.6 });
        // hit sparks
        for (let i = 0; i < (crit ? 5 : 2); i++) {
          FX.spark(opts.x || enemy.x, opts.y || enemy.y - 20, (opts.angle || 0) + Math.PI + U.rand(-0.8, 0.8), U.rand(60, 160), crit ? '#ffd24a' : '#ffd9a8', { life: 0.2, size: U.rand(1, 2) });
        }
        if (crit) this.shake(2.5, 0.14);
        G.Audio.play(crit ? 'crit' : 'hit', { pitch: 0.85 + Math.random() * 0.35 });
      }
      this.run.combo++;
      this.run.comboT = 2.3;
      if (this.run.combo > this.run.bestCombo) this.run.bestCombo = this.run.combo;
      return actual;
    }

    damageObstacle(o, amount, x, y) {
      if (!o || !o.destructible || o.dead) return;
      const before = o.hp;
      o.hp -= Math.max(0, Number.isFinite(amount) ? amount : 5);
      o.flash = 0.14;
      FX.burst(x || o.x + o.w / 2, y || o.y + 12, '#d8c9a8', 3, { speed: 110, drag: 0.8 });
      if (o.hp <= 0) this.breakObstacle(o);
      return Math.min(before, Math.max(0, before - o.hp));
    }

    breakObstacle(o) {
      if (!o || o.dead) return;
      o.dead = true;
      o.solid = false;
      this.run.destroyed++;
      this.run.score += 18;
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      FX.debris(cx, cy, o.type === 'copier' ? ['#2b3448', '#57f4ff', '#e9e4d2'] : ['#c9b48e', '#8f7958', '#e9e4d2'], 12, { speed: 230 });
      FX.paper(cx, cy - 8, 4, '#e9e4d2');
      FX.shake(3, 0.16);
      G.Audio.play('break');
      if (o.loot === 'explode' || o.loot === 'shock') {
        const color = o.loot === 'shock' ? '#57f4ff' : '#ffb35c';
        this.explosion(cx, cy, o.loot === 'shock' ? 120 : 108, (o.loot === 'shock' ? 30 : 40) * this.getDamageMul(), color, 'player');
        for (const q of this.world.obstacles) {
          if (q !== o && q.destructible && !q.dead && U.dist(cx, cy, q.x + q.w / 2, q.y + q.h / 2) < 110) {
            this.damageObstacle(q, 16, q.x + q.w / 2, q.y + q.h / 2);
          }
        }
      } else if (o.loot === 'heal') {
        this.pickups.push(new G.Pickup('heart', cx, cy - 4, 12));
        FX.ring(cx, cy, 6, 58, '#8cffb0', 0.4, 3);
      } else if (o.loot === 'shield') {
        this.pickups.push(new G.Pickup('shield', cx, cy - 4, 10));
      } else {
        for (let i = 0; i < 2; i++) this.pickups.push(new G.Pickup('xp', cx + U.rand(-18, 18), cy + U.rand(-8, 8), 6));
        if (o.loot === 'coin' || o.loot === 'mix') this.pickups.push(new G.Pickup('coin', cx, cy - 4, 6));
      }
      if (!this.run.firstBreak) {
        this.run.firstBreak = true;
        this.toast('办公用品已损坏 · 绩效 -1', 'pink');
      }
    }

    killEnemy(e) {
      if (e.dead) return;
      e.dead = true;
      this.run.kills++;
      this.run.combo += 1;
      this.run.comboT = 2.4;
      FX.death(e.x, e.y - 14, e.data.sprite === 'ghost' ? '#7dffa8' : '#ffb35c', e.elite ? 1.8 : 1);
      FX.paper(e.x, e.y - 20, e.elite ? 7 : 3, e.data.sprite === 'paper' ? '#e9e4d2' : null);
      if (e.data.sprite === 'zombie') FX.debris(e.x, e.y - 20, ['#5a3a20', '#7eae6e', '#33394b'], 8, { speed: 180 });
      G.Audio.play('die', { pitch: 0.9 + Math.random() * 0.2 });
      this.dropLoot(e);
      if (this.run.stats.explodeOnKill && Math.random() < this.run.stats.explodeOnKill) {
        this.explosion(e.x, e.y, 80 * (this.run.stats.explodeSize || 1), 18 * this.getDamageMul(), '#ffb35c', 'player');
        G.Audio.play('explode');
      }
      if (this.run.stats.lifesteal) this.healPlayer(Math.round(this.run.stats.lifesteal), true);
      // fear relic
      if (this.run.stats.fearChance > 0) {
        for (const other of this.enemies) {
          if (!other.dead && other !== e && U.dist(other.x, other.y, e.x, e.y) < 130 && Math.random() < this.run.stats.fearChance) {
            other.fear = 2.2;
            FX.text(other.x, other.y - 50, '!', '#ffd24a', { scale: 2, life: 0.5 });
          }
        }
      }
    }

    dropLoot(e) {
      const xp = e.data.xp;
      const n = U.clamp(Math.round(xp / 3), 1, 4);
      const per = xp / n;
      for (let i = 0; i < n; i++) {
        const p = new G.Pickup('xp', e.x + U.rand(-10, 10), e.y - 20 + U.rand(-8, 8), per);
        this.pickups.push(p);
      }
      let gc = e.elite ? 4 : (Math.random() < 0.55 ? 1 : 0);
      if (Math.random() < 0.18) gc++;
      for (let i = 0; i < gc; i++) {
        this.pickups.push(new G.Pickup('coin', e.x + U.rand(-12, 12), e.y - 18, Math.round(e.data.gold * (e.elite ? 1.4 : 1) * (0.8 + Math.random() * 0.6)), {}));
      }
      if (Math.random() < 0.045) this.pickups.push(new G.Pickup('heart', e.x, e.y - 18, 10));
      if (Math.random() < 0.03) this.pickups.push(new G.Pickup('shield', e.x, e.y - 18, 8));
    }

    explosion(x, y, r, dmg, color, source) {
      FX.ring(x, y, 4, r, color || '#ffb35c', 0.4, 3);
      FX.burst(x, y, color || '#ffb35c', 16, { speed: 260 });
      FX.smoke(x, y, 'rgba(120,120,140,0.25)', 4);
      this.shake(5, 0.26);
      G.Audio.play('explode');
      if (source === 'boss') {
        // Slam telegraphs use the player's ground position and the same radius.
        const p = this.player;
        if (p && !p.dead && U.dist(x, y, p.x, p.y) < r + p.r) {
          if (p.dashT > 0) p.notifyDodge();
          p.takeDamage(dmg, { source: 'boss' });
        }
        return;
      }
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (U.dist(x, y, e.x, e.y - 14) < r + e.r) {
          const a = Math.atan2(e.y - 14 - y, e.x - x);
          this.damageEnemy(e, dmg, { angle: a, knock: 160, x: e.x, y: e.y - 14 });
        }
      }
      if (this.boss && !this.boss.dead && U.dist(x, y, this.boss.x, this.boss.y - 60) < r + 70) {
        this.damageEnemy(this.boss, dmg * 0.8, { x: this.boss.x, y: this.boss.y - 80 });
      }
      for (const o of this.world.obstacles) {
        if (!o.destructible || o.dead) continue;
        if (U.dist(x, y, o.x + o.w / 2, o.y + o.h / 2) < r + Math.max(o.w, o.h) * 0.4) {
          this.damageObstacle(o, dmg * 0.7, o.x + o.w / 2, o.y + o.h / 2);
        }
      }
    }

    nova(x, y, opts) {
      opts = opts || {};
      const power = opts.power || 1;
      const dmg = (88 + this.run.level * 6) * this.run.stats.skillPower * power * this.getDamageMul();
      this.shockwaves.push(new G.Shockwave(x, y, {
        maxR: 240 * (opts.maxMul || 1),
        damage: dmg,
        color: '#57f4ff',
        clears: true,
        width: 5,
        speed: 620,
      }));
      this.clearEnemyBullets();
      FX.flash('white');
      FX.ring(x, y - 18, 8, 190, '#57f4ff', 0.5, 4);
      FX.burst(x, y - 20, '#57f4ff', 26, { speed: 330, drag: 0.86 });
      FX.shake(9, 0.5);
      this.hitstop(0.05);
      G.Audio.play('skill');
      if (!opts.silent) this.toast('超能爆发！', 'gold');
    }

    castDeadline(p) {
      const ang = p.aim;
      const len = 1040;
      const dmg = (128 + this.run.level * 16) * this.run.stats.skillPower * this.getDamageMul();
      this.deadline = {
        x: p.x,
        y: p.y - 28,
        x2: p.x + Math.cos(ang) * len,
        y2: p.y - 28 + Math.sin(ang) * len,
        ang, len, t: 0, fired: false, life: 1.2, dmg,
        color: '#8cffb0',
      };
      this.slowMo(0.24, 0.55);
      this.shake(3, 0.2);
      FX.text(p.x, p.y - 76, 'DEADLINE', '#8cffb0', { scale: 1.5, life: 0.8 });
      G.UI.combatToast('DEADLINE / 死线');
      const char = G.DATA.characters.find((c) => c.id === this.run.character);
      if (char) G.UI.cutIn(char.id, char.skill);
      G.Audio.play('deadlineCharge');
    }

    updateDeadline(dt) {
      const d = this.deadline;
      if (!d) return;
      d.t += dt;
      if (!d.fired && d.t >= 0.42) {
        d.fired = true;
        d.flash = 0.2;
        this.slowMo(0.22, 0.25);
        const { x, y, x2, y2, ang, dmg } = d;
        const reach = 30;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (U.segCircle(x, y, x2, y2, e.x, e.y - 8, reach + e.r)) {
            this.damageEnemy(e, dmg, { angle: ang, knock: 340, x: e.x, y: e.y - 12 });
            if (!e.dead && e.hp > 0 && e.hp / e.hpMax < 0.35) {
              FX.text(e.x, e.y - 52, 'EXECUTE', '#ffd24a', { scale: 1.9, life: 0.8 });
              FX.burst(e.x, e.y - 20, '#ff3d5e', 18, { speed: 260 });
              this.killEnemy(e);
            }
          }
        }
        if (this.boss && !this.boss.dead && U.segCircle(x, y, x2, y2, this.boss.x, this.boss.y - 60, 78)) {
          this.damageEnemy(this.boss, dmg * 1.15, { angle: ang, x: this.boss.x, y: this.boss.y - 80 });
        }
        // cut through enemy bullets
        for (const b of this.bullets) {
          if (b.camp !== 'enemy' || b.dead) continue;
          if (U.segCircle(x, y, x2, y2, b.x, b.y, 26)) {
            b.dead = true;
            FX.spark(b.x, b.y, Math.random() * TAU, 70, b.color || '#ff3d5e', { life: 0.2 });
          }
        }
        FX.beam(x, y, x2, y2, '#8cffb0', 0.4);
        FX.beam(x, y, x2, y2, '#ffffff', 0.16);
        FX.ring(x2, y2, 6, 110, '#8cffb0', 0.45, 3);
        for (let i = 0; i < 18; i++) {
          const p = i / 18;
          FX.spark(x + (x2 - x) * p, y + (y2 - y) * p, ang + Math.PI / 2 * (i % 2 ? 1 : -1), U.rand(50, 170), i % 3 ? '#8cffb0' : '#eafff2', { life: U.rand(0.2, 0.5), size: U.rand(1, 2.5) });
        }
        FX.flash('green');
        FX.shake(14, 0.5);
        this.hitstop(0.1);
        G.Audio.play('deadlineSlash');
      }
      d.flash = Math.max(0, (d.flash || 0) - dt);
      d.life -= dt;
      if (d.life <= 0) this.deadline = null;
    }

    drawDeadline(ctx) {
      const d = this.deadline;
      if (!d) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (!d.fired) {
        const k = Math.min(1, d.t / 0.42);
        const jitter = 2 + k * 2;
        const nx = -Math.sin(d.ang);
        const ny = Math.cos(d.ang);
        ctx.strokeStyle = 'rgba(140,255,176,' + (0.18 + k * 0.45) + ')';
        ctx.lineWidth = 1.2 + k * 1.6;
        ctx.setLineDash([9, 7]);
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        for (let i = 1; i <= 8; i++) {
          const p = i / 8;
          const off = (i % 2 ? 1 : -1) * jitter * (0.4 + p);
          ctx.lineTo(d.x + (d.x2 - d.x) * p + nx * off, d.y + (d.y2 - d.y) * p + ny * off);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(234,255,242,' + (0.35 + k * 0.6) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x2, d.y2);
        ctx.stroke();
        // reticle at the far end
        ctx.strokeStyle = '#8cffb0';
        ctx.globalAlpha = 0.5 + Math.sin(d.t * 28) * 0.3;
        ctx.beginPath();
        ctx.arc(d.x2, d.y2, 10 + k * 8, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(d.x2 - 16, d.y2); ctx.lineTo(d.x2 + 16, d.y2);
        ctx.moveTo(d.x2, d.y2 - 16); ctx.lineTo(d.x2, d.y2 + 16);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // charging glyphs along the line
        for (let i = 0; i < 6; i++) {
          const p = ((d.t * 1.6 + i / 6) % 1);
          const gx = d.x + (d.x2 - d.x) * p;
          const gy = d.y + (d.y2 - d.y) * p;
          ctx.fillStyle = 'rgba(200,255,220,' + (0.7 * (1 - Math.abs(p - 0.5) * 1.4)) + ')';
          ctx.fillRect(gx - 1, gy - 1, 2, 2);
        }
      } else {
        const k = Math.max(0, (d.flash || 0) / 0.2);
        if (k > 0) {
          ctx.strokeStyle = 'rgba(140,255,176,' + (0.38 * k) + ')';
          ctx.lineWidth = 38;
          ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x2, d.y2); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.95 * k) + ')';
          ctx.lineWidth = 9;
          ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x2, d.y2); ctx.stroke();
          ctx.strokeStyle = 'rgba(0,0,0,' + (0.55 * k) + ')';
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x2, d.y2); ctx.stroke();
          // glitch shards around the cut
          for (let i = 0; i < 10; i++) {
            const p = (i + 0.5) / 10;
            const gx = d.x + (d.x2 - d.x) * p;
            const gy = d.y + (d.y2 - d.y) * p;
            const off = (i % 2 ? 1 : -1) * (10 + (i * 7) % 16) * k;
            ctx.fillStyle = 'rgba(140,255,176,' + (0.5 * k) + ')';
            ctx.fillRect(gx - Math.sin(d.ang) * off - 2, gy + Math.cos(d.ang) * off - 2, 4, 4);
          }
        }
        const fade = Math.max(0, d.life / 1.2);
        ctx.strokeStyle = 'rgba(140,255,176,' + (fade * 0.22) + ')';
        ctx.lineWidth = 22;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x2, d.y2); ctx.stroke();
        ctx.strokeStyle = 'rgba(140,255,176,' + (fade * 0.65) + ')';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x2, d.y2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,' + (fade * 0.95) + ')';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x2, d.y2); ctx.stroke();
        // lingering scar
        ctx.strokeStyle = 'rgba(140,255,176,' + (fade * 0.35) + ')';
        ctx.lineWidth = 1;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.moveTo(d.x + 8, d.y + 8);
        ctx.lineTo(d.x2 + 8, d.y2 + 8);
        ctx.stroke();
      }
      ctx.restore();
    }

    castHotfix(p) {
      const bx = p.x - Math.cos(p.aim) * 40;
      const by = p.y + 2;
      this.turrets.push(new G.Turret(this, bx, by));
      this.clearEnemyBullets(p.x, p.y - 20, 190);
      this.addShield(15);
      FX.ring(p.x, p.y - 18, 10, 180, '#57f4ff', 0.5, 4);
      FX.burst(p.x, p.y - 20, '#57f4ff', 20, { speed: 280, drag: 0.84 });
      FX.flash('green');
      FX.shake(5, 0.3);
      G.UI.combatToast('HOTFIX / 热修复');
      this.toast('临时终端已部署 · 8 秒火力支援', 'gold');
      const char = G.DATA.characters.find((c) => c.id === this.run.character);
      if (char) G.UI.cutIn(char.id, char.skill);
      G.Audio.play('hotfix');
    }

    castGaze(p) {
      const st = this.run.stats;
      const ang = p.aim;
      const duration = st.gazeDuration;
      const amp = st.gazeAmp;
      let count = 0;
      const mark = (e, isBoss) => {
        const ey = isBoss ? e.y - 60 : e.y - 16;
        const reach = isBoss ? 760 : 560;
        if (U.dist(p.x, p.y - 24, e.x, ey) > reach) return;
        const a = Math.atan2(ey - (p.y - 24), e.x - p.x);
        const diff = Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang)));
        if (diff > 0.8) return;
        e.markT = duration;
        e.markAmp = amp;
        count++;
        FX.beam(p.x, p.y - 26, e.x, ey, '#8cffb0', 0.22);
        FX.ring(e.x, ey, 4, 26, '#8cffb0', 0.35, 2);
        FX.spark(e.x, ey, Math.random() * TAU, 80, '#8cffb0', { life: 0.3 });
      };
      for (const e of this.enemies) if (!e.dead) mark(e, false);
      if (this.boss && !this.boss.dead) mark(this.boss, true);
      FX.ring(p.x, p.y - 24, 6, 120, '#8cffb0', 0.4, 3);
      FX.flash('green');
      FX.shake(3, 0.18);
      G.UI.combatToast('GAZE / 凝视');
      G.Audio.play('gaze');
      if (count) this.toast('凝视标记 ' + count + ' 个异常：受到伤害 +' + Math.round(amp * 100) + '%', 'gold');
    }

    castEnter(p) {
      const st = this.run.stats;
      const b = this.world.bounds;
      const ang = p.aim;
      const res = U.moveCircle(p.x, p.y, p.r, Math.cos(ang) * 92, Math.sin(ang) * 92,
        { obstacles: this.world.obstacles, bounds: b });
      p.x = res.x;
      p.y = res.y;
      p.invuln = Math.max(p.invuln, 0.35);
      const radius = 105 * st.enterRadius;
      const dmg = (54 + this.run.level * 8) * st.skillPower * st.skill2Power * this.getDamageMul();
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (U.dist(p.x, p.y - 18, e.x, e.y - 16) < radius + e.r) {
          this.damageEnemy(e, dmg, { angle: ang, knock: 260, x: e.x, y: e.y - 12, source: 'enter' });
          e.stunT = Math.max(e.stunT || 0, st.enterStun);
        }
      }
      if (this.boss && !this.boss.dead && U.dist(p.x, p.y - 18, this.boss.x, this.boss.y - 60) < radius + 70) {
        this.damageEnemy(this.boss, dmg * 1.1, { angle: ang, x: this.boss.x, y: this.boss.y - 80, source: 'enter' });
        this.boss.stunT = Math.max(this.boss.stunT || 0, 0.35);
      }
      this.clearEnemyBullets(p.x, p.y - 18, radius + 10);
      FX.ring(p.x, p.y - 18, 8, radius + 20, '#57f4ff', 0.45, 4);
      FX.burst(p.x, p.y - 20, '#57f4ff', 26, { speed: 320, drag: 0.84 });
      FX.flash('white');
      FX.shake(9, 0.4);
      this.hitstop(0.06);
      G.UI.combatToast('ENTER / 回车重击');
      G.Audio.play('enter');
      this.toast('回车重击 · 眩晕 ' + st.enterStun.toFixed(1) + ' 秒', 'gold');
    }

    clearEnemyBullets(x, y, r) {
      for (const b of this.bullets) {
        if (b.camp !== 'enemy') continue;
        if (x == null || U.dist(b.x, b.y, x, y) < r + 20) {
          b.dead = true;
          FX.spark(b.x, b.y, Math.random() * TAU, 60, b.color, { life: 0.2 });
        }
      }
    }

    addXp(n) {
      if (!this.run) return;
      if (!G.Modes.forRun(this.run).xp) return;
      const amt = n * this.run.stats.xpGain;
      this.run.xp += amt;
      let leveled = false;
      while (this.run.xp >= this.run.xpNext) {
        this.run.xp -= this.run.xpNext;
        this.run.level++;
        this.run.weaponLevel = 1 + Math.floor((this.run.level - 1) / 4);
        this.run.xpNext = Math.round(26 + (this.run.level - 1) * 19 + Math.pow(this.run.level, 1.25) * 4);
        this.pendingLevels++;
        leveled = true;
        this.healPlayer(8, true);
      }
      if (leveled) {
        FX.flash('white');
        FX.ring(this.player.x, this.player.y - 20, 8, 140, '#ffd24a', 0.5, 3);
        G.Audio.play('levelup');
        G.UI.fadeHudLevel();
      }
      this.checkLevelUp();
    }

    checkLevelUp() {
      if (this.pendingLevels > 0 && !this.choiceOpen && (this.state === 'play' || this.state === 'cleared')) {
        this.openLevelUp();
      }
    }

    openLevelUp() {
      const run = this.run;
      this.pendingLevels--;
      this.choiceOpen = true;
      this.state = 'levelup';
      G.Audio.play('levelup');
      const items = D.rollUpgrades(run, 3);
      G.UI.showChoice({
        type: 'upgrade',
        eyebrow: 'PROMOTION / LV.' + run.level,
        title: '升职评估',
        sub: '选择一项能力，继续加班。',
        items,
        reroll: true,
      });
    }

    pickUpgrade(item) {
      if (!item) return;
      const run = this.run;
      G.Modes.applyItem(run, item);
      run.upgrades.push(item);
      run.upgradeCounts[item.id] = (run.upgradeCounts[item.id] || 0) + 1;
      run.hp = Math.min(run.hp, run.maxHp);
      if (item.id === 'caffeine') run.hp = Math.min(run.hp, run.maxHp);
      run.hp = Math.max(1, run.hp);
      this.choiceOpen = false;
      this.state = 'play';
      G.UI.hideChoice();
      FX.ring(this.player.x, this.player.y - 20, 8, 110, '#ffd24a', 0.5, 3);
      FX.flash('white');
      G.Audio.play('levelup');
      this.updateHudForce();
      this.checkLevelUp();
    }

    rerollUpgrades() {
      if (this.state !== 'levelup') return;
      const cost = 20 + this.run.rerolls * 8;
      if (this.run.gold < cost) {
        G.Audio.play('deny');
        G.UI.toast('金币不足', 'pink');
        return;
      }
      this.run.gold -= cost;
      this.run.rerolls++;
      G.Audio.play('coin');
      const items = D.rollUpgrades(this.run, 3);
      G.UI.replaceChoiceItems(items, cost + 8);
      this.updateHudForce();
    }

    grantUpgrade(rarities) {
      const items = D.rollUpgrades(this.run, 3, rarities);
      this.choiceOpen = true;
      this.state = 'levelup';
      G.UI.showChoice({
        type: 'upgrade',
        eyebrow: 'REWARD / RARE+',
        title: '额外绩效',
        sub: '稀有度更高的能力。',
        items,
        reroll: false,
      });
    }

    grantUpgradeChoice(rarities) {
      if (this.state !== 'play' && this.state !== 'cleared') return;
      this.grantUpgrade(rarities || ['rare', 'epic', 'legend']);
    }

    grantRelicChoice() {
      const items = D.rollRelics(this.run, 3);
      if (!items.length) { this.toast('遗物已经集齐了', 'gold'); return; }
      this.choiceOpen = true;
      this.state = 'levelup';
      G.Audio.play('levelup');
      G.UI.showChoice({
        type: 'relic',
        eyebrow: 'ARCHIVE / RELIC',
        title: '异常遗物',
        sub: '来自这栋楼的东西，拿一件。',
        items,
        reroll: false,
      });
    }

    pickRelic(item) {
      if (!item) return;
      this.run.relics.push(item);
      G.Modes.applyItem(this.run, item);
      G.Save.markSeen('relics', item.id);
      this.choiceOpen = false;
      this.state = 'play';
      G.UI.hideChoice();
      FX.flash('white');
      FX.burst(this.player.x, this.player.y - 24, '#ffd24a', 26, { speed: 260 });
      G.Audio.play('levelup');
      G.UI.toast('获得遗物：' + item.name, 'gold');
      this.updateHudForce();
      this.checkLevelUp();
    }

    // ============================================================
    // shop
    // ============================================================
    openShopMenu() {
      const run = this.run;
      if (this.world) {
        this.world.interactable = null;
        if (this.world.vending) this.world.vending.opened = true;
      }
      const pool = D.rollUpgrades(run, 2, ['rare', 'epic', 'legend']);
      const relic = D.rollRelics(run, 1)[0];
      const items = [];
      pool.forEach((u, i) => {
        items.push({
          kind: 'upgrade', ref: u,
          name: u.name, desc: u.desc, icon: u.icon, rarity: u.rarity,
          price: 55 + i * 15 + run.roomIndex * 3,
          flavor: u.flavor,
        });
      });
      if (relic) {
        items.push({
          kind: 'relic', ref: relic,
          name: relic.name, desc: relic.desc + '（遗物）', icon: relic.icon, rarity: relic.rarity,
          price: 95 + run.roomIndex * 5,
          flavor: relic.flavor,
        });
      }
      items.push({
        kind: 'heal', name: '三合一能量饮料', desc: '回复 35% 最大生命并附加护盾 15',
        icon: 'heal', rarity: 'common', price: 40, flavor: '味道像电池。',
      });
      items.length = Math.min(items.length, 4);
      this.choiceOpen = true;
      this.state = 'levelup';
      G.UI.showChoice({
        type: 'shop',
        eyebrow: 'VENDING / 24H',
        title: '自动贩卖机',
        sub: '金币 ' + run.gold + ' · 只收公司积分',
        items,
        reroll: false,
        shop: true,
      });
    }

    buyShopItem(item, cardEl) {
      const cost = item.price;
      if (this.run.gold < cost) {
        G.Audio.play('deny');
        G.UI.toast('金币不足', 'pink');
        return false;
      }
      this.run.gold -= cost;
      G.Audio.play('coin');
      if (item.kind === 'upgrade') {
        G.Modes.applyItem(this.run, item.ref);
        this.run.upgrades.push(item.ref);
        this.run.upgradeCounts[item.ref.id] = (this.run.upgradeCounts[item.ref.id] || 0) + 1;
        G.UI.toast('购买：' + item.name, 'gold');
      } else if (item.kind === 'relic') {
        this.run.relics.push(item.ref);
        G.Modes.applyItem(this.run, item.ref);
        G.Save.markSeen('relics', item.ref.id);
        G.UI.toast('购买遗物：' + item.name, 'gold');
      } else if (item.kind === 'heal') {
        this.healPlayer(this.run.maxHp * 0.35);
        this.addShield(15);
      }
      this.run.hp = Math.min(this.run.hp, this.run.maxHp);
      this.updateHudForce();
      this.choiceOpen = false;
      this.state = 'play';
      G.UI.closeChoice();
      return true;
    }

    // ============================================================
    // player util
    // ============================================================
    healPlayer(n, silent) {
      if (!this.run) return;
      n = G.Modes.healAmount(this.run, n);
      const before = this.run.hp;
      this.run.hp = Math.min(this.run.maxHp, this.run.hp + n);
      const gained = this.run.hp - before;
      if (!silent) {
        FX.text(this.player.x, this.player.y - 60, '+' + Math.round(gained), '#a6ff5e', { scale: 1.8 });
        FX.burst(this.player.x, this.player.y - 26, '#a6ff5e', 8, { speed: 120, drag: 0.9 });
      }
      if (gained > 3 && !silent) G.Audio.play('heal');
    }

    addShield(n) {
      if (!this.run) return;
      this.run.shield = Math.min(80, this.run.shield + n);
      G.Audio.play('pickup');
      FX.ring(this.player.x, this.player.y - 24, 10, 44, '#57f4ff', 0.4, 2);
    }

    addGold(n) {
      if (!this.run) return;
      this.run.gold += Math.round(n * this.run.stats.goldGain);
    }

    onKeyPickup() {
      this.toast('拾取了一把黄铜钥匙', 'gold');
      this.run.gold += 25;
    }

    setHpDebounce() {
      this.hpDebounce = 0.8;
    }

    hitstop(t) {
      FX.stop(t);
    }

    slowMo(scale, dur) {
      this.slowT = Math.max(this.slowT, dur);
      this.slowScale = scale;
    }

    shake(mag, dur) {
      FX.shake(mag, dur);
    }

    toast(msg, type) {
      G.UI.toast(msg, type);
    }

    hudWave(a, b) {
      G.UI.hudWave(a, b);
    }

    hudBossPhase(p) {
      G.UI.hudBossPhase(p);
    }

    updateHudForce() {
      G.UI.updateHud(this, true);
      G.UI.refreshRelics(this);
    }

    // ============================================================
    // boss
    // ============================================================
    bossSlamZones(n) {
      for (let i = 0; i < n; i++) {
        let x, y;
        if (i < 2) {
          x = this.player.x + U.rand(-80, 80);
          y = this.player.y + U.rand(-50, 50);
        } else {
          x = U.rand(120, 840);
          y = U.rand(200, 470);
        }
        x = U.clamp(x, 80, 880);
        y = U.clamp(y, 140, 490);
        this.slamZones.push(new G.SlamZone(x, y, U.rand(60, 82), 0.95 + i * 0.08));
      }
      G.Audio.play('warn');
    }

    bossDefeated(boss) {
      if (boss.dead) return;
      if (G.Modes.bossDefeated(this, boss)) return;
      boss.dead = true;
      this.state = 'victory-pending';
      G.Audio.stopLaser();
      G.Audio.setMood('none');
      G.Audio.play('victory');
      this.clearEnemyBullets();
      FX.flash('white');
      FX.shake(18, 1.6);
      FX.stop(0.2);
      this.slowMo(0.25, 2.2);
      for (let i = 0; i < 8; i++) {
        this.after(0.12 * i, () => {
          const x = boss.x + U.rand(-90, 90);
          const y = boss.y - 70 + U.rand(-50, 50);
          FX.death(x, y, i % 2 ? '#ff3d5e' : '#ffd24a', 1.4);
          FX.paper(x, y, 8);
          G.Audio.play('explode');
        });
      }
      const runRef = this.run;
      setTimeout(() => {
        if (this.run !== runRef) return;
        this.run.victory = true;
        this.endRun(true);
      }, 2300);
    }

    // ============================================================
    // game over / victory
    // ============================================================
    gameOver() {
      if (this.state === 'gameover' || this.state === 'victory' || this.state === 'death-pending') return;
      this.state = 'death-pending';
      this.run.victory = false;
      G.Audio.stopLaser();
      G.Audio.setMood('none');
      G.Audio.play('gameover');
      this.afterDeath();
      const runRef = this.run;
      setTimeout(() => {
        if (this.run !== runRef) return;
        this.endRun(false);
      }, 900);
    }

    afterDeath() {
      FX.shake(12, 0.9);
    }

    endRun(win) {
      const run = this.run;
      if (this.savedRun) return;
      this.savedRun = true;
      const score = Math.round(run.kills * 12 + run.gold * 1.2 + run.level * 90 + run.roomsCleared * 160 + run.bestCombo * 3 + (win ? 1500 : 0));
      run.score = score;
      const time = run.time;
      const points = G.Modes.points(run, win, score);
      run.pointsEarned = points;
      G.Save.recordRun({ mode: run.mode, score, kills: run.kills, room: run.roomIndex, time, win, points, level: run.level, gold: run.gold, bestCombo: run.bestCombo, upgrades: run.upgrades.map((u) => u.name), relics: run.relics.map((r) => r.name), character: run.character, weapon: run.weapon });
      this.state = win ? 'victory' : 'gameover';
      G.Audio.setMood(win ? 'menu' : 'none');
      G.UI.showGameOver(this, win);
    }

    // ============================================================
    // loop
    // ============================================================
    loop(ts) {
      requestAnimationFrame((t) => this.loop(t));
      if (!this.last) this.last = ts;
      const dt = Math.max(0, Math.min(0.25, (ts - this.last) / 1000));
      this.last = ts;
      this.advanceFrame(dt);
      this.render();
    }

    advanceFrame(dt) {
      dt = Math.max(0, Math.min(0.25, dt));
      this.time += dt;
      this.menuT += dt;

      if (this.state === 'menu' || this.state === 'boot') {
        if (this.menuWorld) {
          this.menuWorld.update(dt);
          this.menuWorld.t += 0;
        }
        FX.update(dt);
      } else if (this.state === 'play' || this.state === 'cleared' || this.state === 'fade' || this.state === 'victory-pending') {
        const step = 1 / 120;
        this.acc += dt;
        while (this.acc + 1e-10 >= step) {
          this.acc -= step;
          this.stepGame(step);
          if (!['play', 'cleared', 'fade', 'victory-pending'].includes(this.state)) { this.acc = 0; break; }
        }
      } else {
        this.acc = 0;
        FX.update(dt * 0.4);
        this.updateHud();
      }
    }

    stepGame(dt) {
      const run = this.run;
      if (!run) return;
      // The run clock includes hit-stop; pause and menus never enter this branch.
      if (this.state === 'play' || this.state === 'cleared') run.time += dt;
      G.Modes.update(this);
      // hit stop
      if (this.hitstopT > 0) { this.hitstopT -= dt; }
      if (FX.hitstop > 0) {
        FX.hitstop -= dt;
        FX.update(dt * 0.25);
        this.updateHud();
        return;
      }
      let timeScale = 1;
      if (this.slowT > 0) {
        this.slowT -= dt;
        timeScale = this.slowScale;
      }
      if (this.hpDebounce > 0) this.hpDebounce -= dt;
      // input mouse idle
      this.input.mouseIdleT += dt;
      if (this.input.mouseIdleT > 1.2) this.input.mouseMovedRecently = false;
      this.input.aimX = this.mouseX;
      this.input.aimY = this.mouseY;

      if (this.state === 'play' || this.state === 'cleared') {
        // timers only advance while playable
        if (this.state === 'play' || this.state === 'cleared') {
          for (let i = this.timers.length - 1; i >= 0; i--) {
            const tm = this.timers[i];
            tm.t -= dt;
            if (tm.t <= 0) {
              this.timers.splice(i, 1);
              try { tm.fn(); } catch (err) { console.error(err); }
              if (!this.canAct()) break;
            }
          }
        }
        if (!this.canAct()) { FX.update(dt); return; }
        // world
        if (this.world && this.state !== 'fade') {
          this.world.update(dt);
          G.Exploration.update(this, dt);
        }
        if (!this.canAct()) { FX.update(dt); return; }
        // player
        if (this.player && !this.player.dead) {
          this.player.update(dt);
          if (this.state === 'play') this.checkLevelUp();
        }
        if (!this.canAct()) { FX.update(dt); return; }
        this.updateInteractions();
        this.consumeActions(dt);
        if (!this.canAct()) { FX.update(dt); return; }
        // enemies
        const edt = dt * timeScale;
        for (const e of this.enemies) {
          if (!e.dead) e.update(edt, this);
          if (!this.canAct()) break;
        }
        this.enemies = this.enemies.filter((e) => !e.dead);
        // boss
        if (this.boss && !this.boss.dead) this.boss.update(dt, this);
        if (!this.canAct()) { FX.update(dt); return; }
        // bullets
        for (const b of this.bullets) b.update(edt, this);
        this.bullets = this.bullets.filter((b) => !b.dead);
        // pickups
        for (const p of this.pickups) p.update(dt, this);
        this.pickups = this.pickups.filter((p) => !p.dead);
        // character skills
        if (this.deadline) this.updateDeadline(dt);
        for (const tu of this.turrets) tu.update(dt, this);
        this.turrets = this.turrets.filter((tu) => !tu.dead);
        // shockwaves
        for (const s of this.shockwaves) s.update(edt, this);
        this.shockwaves = this.shockwaves.filter((s) => !s.dead);
        // slam zones
        for (const z of this.slamZones) z.update(dt, this);
        this.slamZones = this.slamZones.filter((z) => !z.dead);
        // afterimages
        for (const a of this.afterimages) { a.t -= dt; }
        this.afterimages = this.afterimages.filter((a) => a.t > 0);
        // combo decay
        if (run.comboT > 0) {
          run.comboT -= dt;
          if (run.comboT <= 0) run.combo = 0;
        }
        // interactions
        this.updateInteractions();
        // room transition safety: if world cleared and no doors for too long
      }
      FX.update(dt);
      this.hudT += dt;
      if (this.hudT > 0.05) {
        this.hudT = 0;
        this.updateHud();
      }
    }

    updateInteractions() {
      this.interactTarget = null;
      this.interactLabel = '';
      if (!this.world || !this.player || this.state !== 'play') {
        G.UI.setInteract('');
        return;
      }
      let best = null, bestD = 1e9;
      for (const d of this.world.doors) {
        const dist = U.dist(this.player.x, this.player.y, d.x, d.y);
        if (!d.explorationLocked && dist <= G.Exploration.RANGE && dist < bestD) {
          best = { type: 'door', data: d };
          bestD = dist;
          const dd = D.doors[d.type];
          this.interactLabel = '按 E 进入 · ' + dd.name;
        }
      }
      const inter = this.world.interactable;
      if (inter && !(inter.opened) && this.world.phase === 'cleared') {
        const cx = inter.x + inter.w / 2, cy = inter.y + inter.h / 2;
        const dist = U.dist(this.player.x, this.player.y, cx, cy);
        if (dist <= G.Exploration.RANGE && dist < bestD) {
          best = { type: inter.interact, data: inter };
          bestD = dist;
          this.interactLabel = inter.interact === 'chest' ? '按 E 打开保险箱' : '按 E 使用自动贩卖机';
        }
      }
      const ex = G.Exploration.target(this);
      if (ex && ex.distance < bestD) {
        best = ex;
        this.interactLabel = ex.label;
      }
      this.interactTarget = best;
      G.UI.setInteract(best ? this.interactLabel : '');
      const button = document.getElementById('touch-interact');
      if (button) button.disabled = !best;
    }

    updateHud() {
      if (!this.run) return;
      G.UI.updateHud(this);
    }

    // ============================================================
    // render
    // ============================================================
    resetCtx(ctx) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    render() {
      const ctx = this.ctx;
      const s = this.scale;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      this.resetCtx(ctx);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#05070d';
      ctx.fillRect(0, 0, W, H);
      if (this.state === 'menu' || this.state === 'boot' || !this.run) {
        this.renderMenuScene(ctx);
        return;
      }
      this.renderGame(ctx);
    }

    renderMenuScene(ctx) {
      const w = this.menuWorld;
      if (w) {
        w.t = this.menuT * 0.6;
        w.drawBackdrop(ctx);
        w.drawEdges(ctx);
      }
      // stage haze / central light beam to lift the scene
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const beam = ctx.createRadialGradient(500, 60, 20, 500, 330, 560);
      beam.addColorStop(0, 'rgba(70,150,205,0.16)');
      beam.addColorStop(0.45, 'rgba(45,100,150,0.06)');
      beam.addColorStop(1, 'rgba(20,40,70,0)');
      ctx.fillStyle = beam;
      ctx.fillRect(0, 0, 960, 540);
      ctx.restore();
      // the door at the end of the hall
      const doorX = 468, doorY = 372;
      const t = this.menuT;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      U.glow(ctx, doorX, doorY - 30, 110, '#57f4ff', 0.12);
      ctx.restore();
      ctx.save();
      // portal inner light
      const inner = ctx.createLinearGradient(0, doorY - 88, 0, doorY + 6);
      inner.addColorStop(0, 'rgba(57,244,255,0)');
      inner.addColorStop(0.5, 'rgba(57,244,255,0.05)');
      inner.addColorStop(1, 'rgba(57,244,255,0.16)');
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.ellipse(doorX, doorY - 26, 28, 50, 0, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      U.glow(ctx, doorX, doorY, 46, '#57f4ff', 0.18);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(87,244,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(doorX, doorY - 26, 30, 52, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,61,129,0.34)';
      ctx.beginPath();
      ctx.ellipse(doorX, doorY - 26, 42, 64, 0, 0, TAU);
      ctx.stroke();
      // up arrow glyph
      ctx.strokeStyle = 'rgba(210,255,255,0.8)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(doorX - 6, doorY - 34);
      ctx.lineTo(doorX, doorY - 42);
      ctx.lineTo(doorX + 6, doorY - 34);
      ctx.stroke();
      // rising sparks
      for (let i = 0; i < 12; i++) {
        const yy = (t * 26 + i * 17) % 86;
        ctx.fillStyle = 'rgba(150,255,255,' + (0.55 * (1 - yy / 86)) + ')';
        ctx.fillRect(doorX + Math.sin(t * 2 + i * 2) * 14, doorY - 20 - yy, 2, 3);
      }
      ctx.restore();
      // ambient floating dust
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const x = (i * 173 + this.menuT * 8) % 960;
        const y = 120 + ((i * 91 + this.menuT * 14) % 380);
        ctx.globalAlpha = 0.12 + (Math.sin(this.menuT + i) * 0.5 + 0.5) * 0.14;
        ctx.fillStyle = i % 3 === 0 ? '#ff3d81' : '#57f4ff';
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      ctx.restore();
      // foreground fog
      const fg = ctx.createLinearGradient(0, 380, 0, 540);
      fg.addColorStop(0, 'rgba(5,8,15,0)');
      fg.addColorStop(1, 'rgba(5,8,15,0.75)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 380, 960, 160);
    }

    renderGame(ctx) {
      const world = this.world;
      const t = this.time;
      ctx.save();
      ctx.translate(Math.round(FX.shakeX), Math.round(FX.shakeY));
      this.resetCtx(ctx);
      world.drawBackdrop(ctx);
      this.resetCtx(ctx);
      world.drawZones(ctx);
      world.drawDoors(ctx);
      this.resetCtx(ctx);
      // afterimages
      for (const a of this.afterimages) {
        ctx.save();
        ctx.globalAlpha = (a.t / a.life) * 0.24;
        SP.drawPlayer(ctx, this.run.character, a.x, a.y, {
          t, walk: 0, moving: true, flip: a.flip, aim: a.aim, weapon: a.weapon, alpha: 1,
        });
        ctx.restore();
      }
      // y-sorted actors
      const list = [];
      for (const o of world.obstacles) {
        if (o.dead) continue;
        list.push({ y: o.y + o.h, draw: () => {
          SP.drawObstacle(ctx, o, t);
          if (o.destructible && o.hp < o.maxHp && o.hp > 0) {
            const bx = o.x + o.w / 2;
            const bw = Math.min(46, o.w * 0.7);
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(bx - bw / 2 - 1, o.y - 7, bw + 2, 4);
            ctx.fillStyle = '#ffd24a';
            ctx.fillRect(bx - bw / 2, o.y - 6, bw * (o.hp / o.maxHp), 2);
          }
        } });
      }
      for (const p of this.pickups) {
        list.push({ y: p.y + 4, draw: () => p.draw(ctx) });
      }
      for (const e of this.enemies) {
        list.push({ y: e.y, draw: () => e.draw(ctx, t) });
      }
      if (this.boss && !this.boss.dead) {
        list.push({ y: this.boss.y - 4, draw: () => this.boss.draw(ctx, t) });
      }
      if (this.player && !this.player.dead) {
        list.push({ y: this.player.y, draw: () => this.player.draw(ctx, t) });
      }
      for (const tu of this.turrets) {
        list.push({ y: tu.y - 2, draw: () => tu.draw(ctx, t) });
      }
      list.sort((a, b) => a.y - b.y);
      for (const it of list) {
        this.resetCtx(ctx);
        it.draw();
      }
      // bullets above actors
      this.resetCtx(ctx);
      for (const b of this.bullets) b.draw(ctx);
      // shockwaves
      for (const s of this.shockwaves) s.draw(ctx);
      if (this.deadline) this.drawDeadline(ctx);
      // fx
      this.resetCtx(ctx);
      FX.draw(ctx);
      this.resetCtx(ctx);
      // Gameplay warnings remain readable above particles, including reduced FX.
      for (const z of this.slamZones) if (!z.dead) z.draw(ctx);
      this.resetCtx(ctx);
      world.drawRain(ctx);
      world.drawInteractHint(ctx);
      G.Exploration.draw(ctx, world);
      world.drawEdges(ctx);
      ctx.restore();
      this.resetCtx(ctx);
      // crosshair (outside shake)
      this.drawCrosshair(ctx);
      // slow-mo tint
      if (this.slowT > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(40,200,255,0.05)';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      // room clear edge glow
      if (world.phase === 'cleared') {
        ctx.save();
        const g = ctx.createLinearGradient(0, 0, 0, 20);
        g.addColorStop(0, 'rgba(87,244,255,0.18)');
        g.addColorStop(1, 'rgba(87,244,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, 20);
        ctx.restore();
      }
    }

    drawCrosshair(ctx) {
      if (this.input.usingTouch) return;
      const target = this.player && this.player.aimTarget && !this.player.aimTarget.dead ? this.player.aimTarget : null;
      const x = target ? target.x : this.mouseX;
      const y = target ? (target === this.boss ? target.y - 80 : target.y - 18) : this.mouseY;
      if (x < 2 && y < 2) return;
      const col = target ? '#8cffb0' : (this.player && this.player.weapon ? this.player.weapon.color : '#57f4ff');
      if (target) {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 7]);
        ctx.beginPath();
        ctx.moveTo(this.player.x, this.player.y - 26);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, target ? 9 : 7, 0, TAU);
      ctx.stroke();
      if (target) {
        ctx.strokeStyle = 'rgba(180,255,205,0.9)';
        ctx.beginPath();
        ctx.moveTo(x - 14, y - 7); ctx.lineTo(x - 14, y - 12); ctx.lineTo(x - 9, y - 12);
        ctx.moveTo(x + 14, y - 7); ctx.lineTo(x + 14, y - 12); ctx.lineTo(x + 9, y - 12);
        ctx.moveTo(x - 14, y + 7); ctx.lineTo(x - 14, y + 12); ctx.lineTo(x - 9, y + 12);
        ctx.moveTo(x + 14, y + 7); ctx.lineTo(x + 14, y + 12); ctx.lineTo(x + 9, y + 12);
        ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.fillRect(x - 1, y - 1, 2, 2);
      ctx.fillRect(x - 13, y - 1, 5, 2);
      ctx.fillRect(x + 8, y - 1, 5, 2);
      ctx.fillRect(x - 1, y - 13, 2, 5);
      ctx.fillRect(x - 1, y + 8, 2, 5);
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  // aliased so the menu scene can be built before class hoisting confusion
  const W_World = G.World;
  G.Game = Game;
})();
