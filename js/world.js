/* ============================================================
   world.js — room generation, hand-drawn backdrop, waves, doors
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;
  const FX = G.FX;
  const SP = G.Sprites;
  const TAU = Math.PI * 2;

  const WALL_H = 86;
  const FLOOR_Y = 86;

  class World {
    constructor(game, index, kind) {
      this.game = game;
      this.index = index;
      this.kind = kind || 'battle';
      this.seed = (Math.random() * 1e9) | 0;
      this.rnd = U.rng(this.seed);
      this.themeId = index >= 6 ? 'exec' : G.DATA.rooms[Math.min(index, G.DATA.rooms.length - 1)].theme;
      this.theme = G.DATA.themes[this.themeId];
      this.bounds = { x: 30, y: 104, w: 900, h: 404 };
      this.spawn = { x: 480, y: 430 };
      this.obstacles = [];
      this.doors = [];
      this.windows = [];
      this.lamps = [];
      this.motes = [];
      this.papers = [];
      this.waves = [];
      this.waveIndex = 0;
      this.spawnQueue = [];
      this.spawnTimer = 0;
      this.phase = 'pre';
      this.timer = 1.1;
      this.t = 0;
      this.cleared = false;
      this.chest = null;
      this.vending = null;
      this.interactable = null;
      this.terminal = null;
      this.ambientT = 0;
      this.rain = [];
      this.rainT = 0;
      this.lightningT = 5;
      this.bg = null;
      this.doorShapes = {};
      this.build();
    }

    // ---------------- build ----------------
    build() {
      this.generateObstacles();
      this.buildBackdrop();
      this.makeMotes();
      const plan = G.DATA.wavesForRoom(this.index, this.kind);
      this.waves = plan.waves;
      this.hpMul = plan.hpMul;
      this.speedMul = 1 + (this.game.run ? this.game.run.curseNextRoomSpeed || 0 : 0);
      if (this.game.run && this.game.run.curseNextRoom) this.hpMul *= 1 + this.game.run.curseNextRoom;
      if (this.game.run && this.game.run.enemyHpBonus) this.hpMul *= 1 + this.game.run.enemyHpBonus;
      if (this.game.run) this.game.run.curseNextRoom = 0;
      if (this.game.run) this.game.run.curseNextRoomSpeed = 0;
      if (this.game.run) this.game.run.enemyHpBonus = 0;
      if (G.Exploration) this.terminal = G.Exploration.attach(this);
    }

    obstacleSize(type) {
      switch (type) {
        case 'desk': return { w: 118 + this.rnd() * 42, h: 50 + this.rnd() * 8 };
        case 'partition': return { w: 96 + this.rnd() * 58, h: 22 };
        case 'plant': return { w: 30, h: 20 };
        case 'sofa': return { w: 104 + this.rnd() * 40, h: 32 };
        case 'cooler': return { w: 28, h: 30 };
        case 'table': return { w: 140 + this.rnd() * 46, h: 52 };
        case 'copier': return { w: 58, h: 44 };
        case 'cabinet': return { w: 44, h: 38 };
        case 'vending': return { w: 50, h: 42 };
        case 'chest': return { w: 44, h: 34 };
        case 'server': return { w: 46, h: 46 };
        case 'fridge': return { w: 46, h: 52 };
        case 'whiteboard': return { w: 96 + this.rnd() * 40, h: 34 };
        case 'boxes': return { w: 66, h: 42 };
        case 'bossdesk': return { w: 190, h: 62 };
        default: return { w: 80, h: 40 };
      }
    }

    decorateObstacle(o) {
      const cfg = {
        boxes: { hp: 28, loot: 'mix' },
        copier: { hp: 46, loot: 'explode' },
        cooler: { hp: 22, loot: 'heal' },
        cabinet: { hp: 58, loot: 'coin' },
        plant: { hp: 14, loot: 'xp' },
        server: { hp: 42, loot: 'shock' },
        fridge: { hp: 38, loot: 'shield' },
        whiteboard: { hp: 30, loot: 'xp' },
      };
      const c = cfg[o.type];
      if (!c) return o;
      o.destructible = true;
      o.maxHp = c.hp;
      o.hp = c.hp;
      o.loot = c.loot;
      o.flash = 0;
      return o;
    }

    generateObstacles() {
      if (this.index >= 6) {
        // keep the penthouse arena open for the boss
        this.obstacles.push(this.decorateObstacle({ type: 'plant', x: 58, y: 474, w: 30, h: 20, seed: 3, solid: true }));
        this.obstacles.push(this.decorateObstacle({ type: 'plant', x: 866, y: 474, w: 30, h: 20, seed: 4, solid: true }));
        return;
      }
      const pool = this.theme.objs.slice();
      const target = 5 + Math.floor(this.rnd() * 2);
      const zone = { x: 78, y: 150, w: 806, h: 326 };
      const placed = [];
      // build a bag of varied types (reshuffle each lap so density feels curated)
      const bag = [];
      while (bag.length < target) bag.push(...U.shuffle(pool));
      bag.length = target;
      for (let i = 0; i < target; i++) {
        const type = bag[i];
        const sz = this.obstacleSize(type);
        let ok = false;
        for (let tries = 0; tries < 50 && !ok; tries++) {
          const x = zone.x + this.rnd() * (zone.w - sz.w);
          const y = zone.y + this.rnd() * (zone.h - sz.h);
          const rc = { x, y, w: sz.w, h: sz.h };
          // keep spawn area & center aisle safe
          if (U.dist(x + sz.w / 2, y + sz.h / 2, this.spawn.x, this.spawn.y) < 145) continue;
          if (U.dist(x + sz.w / 2, y + sz.h / 2, 480, 300) < 60) continue;
          let overlap = false;
          for (const o of placed) {
            if (U.rectsOverlap(rc, o, 24)) { overlap = true; break; }
          }
          if (overlap) continue;
          ok = true;
          placed.push({ x, y, w: sz.w, h: sz.h });
          this.obstacles.push({
            type, x, y, w: sz.w, h: sz.h, seed: Math.floor(this.rnd() * 9999),
            top: this.theme.id === 'pantry' ? '#4a3a30' : this.theme.id === 'meeting' ? '#3a3352' : this.theme.id === 'exec' ? '#3d2a2a' : '#3b4a63',
            front: this.theme.id === 'pantry' ? '#2a1e1a' : this.theme.id === 'meeting' ? '#211c33' : this.theme.id === 'exec' ? '#241517' : '#1d2738',
            edge: this.theme.id === 'pantry' ? '#6b5444' : this.theme.id === 'meeting' ? '#5b4e7a' : this.theme.id === 'exec' ? '#7a5040' : '#5c7190',
            solid: type !== 'chest',
          });
        }
      }
      // corner set dressing
      if (this.rnd() < 0.85) {
        this.obstacles.push({ type: 'plant', x: 62 + this.rnd() * 10, y: 132 + this.rnd() * 16, w: 30, h: 20, seed: Math.floor(this.rnd() * 99), solid: true });
      }
      if (this.rnd() < 0.55) {
        this.obstacles.push({ type: 'boxes', x: 824 + this.rnd() * 22, y: 452 + this.rnd() * 16, w: 54, h: 34, seed: Math.floor(this.rnd() * 99), solid: true });
      }
      for (const o of this.obstacles) this.decorateObstacle(o);
      // every room is guaranteed at least one thing you can break
      if (!this.obstacles.some((o) => o.destructible)) {
        const o = { type: 'boxes', x: 820, y: 452, w: 54, h: 34, seed: 7, solid: true };
        this.obstacles.push(this.decorateObstacle(o));
      }
    }

    // ---------------- backdrop ----------------
    buildBackdrop() {
      const W = 960, H = 540;
      const c = U.makeCanvas(W * 2, H * 2);
      const g = c.getContext('2d');
      g.scale(2, 2);
      g.imageSmoothingEnabled = false;
      this.bctx = g;
      this.drawFloor(g);
      this.drawWall(g);
      this.drawWindows(g);
      this.drawWallDeco(g);
      this.drawLamps(g);
      this.drawFloorDeco(g);
      this.bg = c;
      this.bctx = null;
    }

    drawFloor(g) {
      const th = this.theme;
      const grd = g.createLinearGradient(0, FLOOR_Y, 0, 540);
      grd.addColorStop(0, th.floorA);
      grd.addColorStop(1, th.floorB);
      g.fillStyle = grd;
      g.fillRect(0, FLOOR_Y, 960, 540 - FLOOR_Y);

      // large rug
      g.fillStyle = 'rgba(0,0,0,0.16)';
      g.fillRect(92, 130, 776, 372);
      g.strokeStyle = th.tile;
      g.lineWidth = 2;
      g.strokeRect(92, 130, 776, 372);
      g.strokeStyle = 'rgba(255,255,255,0.025)';
      g.strokeRect(102, 140, 756, 352);

      // tile grid
      g.strokeStyle = th.tile;
      g.lineWidth = 1;
      for (let x = 0; x <= 960; x += 48) {
        g.beginPath(); g.moveTo(x, FLOOR_Y); g.lineTo(x, 540); g.stroke();
      }
      for (let y = FLOOR_Y; y <= 540; y += 48) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(960, y); g.stroke();
      }
      // subtle tile highlights
      for (let i = 0; i < 260; i++) {
        const x = this.rnd() * 960;
        const y = FLOOR_Y + this.rnd() * (540 - FLOOR_Y);
        g.fillStyle = this.rnd() < 0.5 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.08)';
        g.fillRect(Math.floor(x), Math.floor(y), 2 + Math.floor(this.rnd() * 3), 1);
      }
      // wall-floor seam shadow
      const sh = g.createLinearGradient(0, FLOOR_Y, 0, FLOOR_Y + 34);
      sh.addColorStop(0, 'rgba(0,0,0,0.6)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh;
      g.fillRect(0, FLOOR_Y, 960, 34);

      if (this.themeId === 'exec') {
        // red carpet
        const rg = g.createLinearGradient(0, 170, 0, 540);
        rg.addColorStop(0, 'rgba(90,12,26,0.42)');
        rg.addColorStop(1, 'rgba(40,6,14,0.16)');
        g.fillStyle = rg;
        g.fillRect(250, 150, 460, 400);
        g.strokeStyle = 'rgba(255,210,74,0.22)';
        g.strokeRect(258, 158, 444, 384);
      }
    }

    drawWall(g) {
      const th = this.theme;
      const grd = g.createLinearGradient(0, 0, 0, WALL_H);
      grd.addColorStop(0, th.wallLo);
      grd.addColorStop(0.55, th.wall);
      grd.addColorStop(1, th.wallHi);
      g.fillStyle = grd;
      g.fillRect(0, 0, 960, WALL_H);
      // panel seams
      g.strokeStyle = 'rgba(0,0,0,0.24)';
      g.lineWidth = 1;
      for (let x = 0; x < 960; x += 120) {
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, WALL_H - 8); g.stroke();
      }
      // top shadow
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(0, 0, 960, 9);
      // baseboard
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, WALL_H - 8, 960, 8);
      g.fillStyle = U.rgba(th.neon, 0.12);
      g.fillRect(0, WALL_H - 9, 960, 1);
      // faint vertical light from ceiling
      for (let i = 0; i < 4; i++) {
        const x = 140 + i * 240;
        const lg = g.createLinearGradient(x, 0, x, WALL_H);
        lg.addColorStop(0, U.rgba(th.lamp, 0.12));
        lg.addColorStop(1, U.rgba(th.lamp, 0));
        g.fillStyle = lg;
        g.fillRect(x - 40, 0, 80, WALL_H);
      }
    }

    drawWindows(g) {
      const th = this.theme;
      const isExec = this.themeId === 'exec';
      const wins = isExec
        ? [{ x: 120, y: 16, w: 720, h: 58, big: true }]
        : [{ x: 196, y: 20, w: 230, h: 44 }, { x: 596, y: 20, w: 210, h: 44 }];
      this.windows = [];
      for (const w of wins) {
        this.windows.push(w);
        // frame
        g.fillStyle = '#05080e';
        g.fillRect(w.x - 5, w.y - 5, w.w + 10, w.h + 10);
        g.fillStyle = '#1b2636';
        g.fillRect(w.x - 3, w.y - 3, w.w + 6, w.h + 6);
        // sky
        const sky = g.createLinearGradient(0, w.y, 0, w.y + w.h);
        sky.addColorStop(0, th.window);
        sky.addColorStop(1, U.mix(th.window, '#000000', 0.35));
        g.fillStyle = sky;
        g.fillRect(w.x, w.y, w.w, w.h);
        // city silhouettes
        const bRnd = U.rng(this.seed + w.x);
        let bx = w.x - 10;
        while (bx < w.x + w.w) {
          const bw = 18 + bRnd() * 34;
          const bh = 14 + bRnd() * (w.h * 0.75);
          const by = w.y + w.h - bh;
          g.fillStyle = th.winCity[Math.floor(bRnd() * th.winCity.length)];
          g.fillRect(bx, by, bw, bh);
          // windows lights
          for (let yy = by + 4; yy < w.y + w.h - 3; yy += 6) {
            for (let xx = bx + 3; xx < bx + bw - 3; xx += 6) {
              if (bRnd() < 0.42) {
                g.fillStyle = bRnd() < 0.16 ? 'rgba(255,210,74,0.75)' : bRnd() < 0.5 ? 'rgba(120,220,255,0.4)' : 'rgba(255,120,160,0.3)';
                g.fillRect(xx, yy, 2, 2);
              }
            }
          }
          // neon sign
          if (bRnd() < 0.3) {
            g.fillStyle = bRnd() < 0.5 ? 'rgba(255,61,129,0.6)' : 'rgba(57,244,255,0.55)';
            g.fillRect(bx + 4, by + 5, 3, bh * 0.4);
            g.fillRect(bx + 4, by + 5 + bh * 0.4, 2, 3);
          }
          bx += bw + 2 + bRnd() * 6;
        }
        // glass reflection
        const ref = g.createLinearGradient(w.x, w.y, w.x + w.w, w.y + w.h);
        ref.addColorStop(0, 'rgba(255,255,255,0.09)');
        ref.addColorStop(0.35, 'rgba(255,255,255,0.02)');
        ref.addColorStop(1, 'rgba(255,255,255,0.06)');
        g.fillStyle = ref;
        g.fillRect(w.x, w.y, w.w, w.h);
        // mullions
        if (w.big) {
          for (let i = 1; i < 5; i++) {
            g.fillStyle = '#0a0f16';
            g.fillRect(w.x + (w.w / 5) * i - 2, w.y, 4, w.h);
          }
        } else {
          g.fillStyle = '#0a0f16';
          g.fillRect(w.x + w.w / 2 - 2, w.y, 4, w.h);
        }
        // sill
        g.fillStyle = '#2a3648';
        g.fillRect(w.x - 6, w.y + w.h + 4, w.w + 12, 3);
      }
    }

    drawWallDeco(g) {
      const th = this.theme;
      const decos = th.wallDeco;
      const pick = decos[(this.seed >>> 3) % decos.length];
      const pick2 = decos[(this.seed >>> 7) % decos.length];
      const spots = [120, 460, 860];
      const rnd = U.rng(this.seed + 77);

      // clock
      const drawClock = (cx, cy) => {
        g.fillStyle = '#080d14';
        g.beginPath(); g.arc(cx, cy, 19, 0, TAU); g.fill();
        g.fillStyle = '#1a2533';
        g.beginPath(); g.arc(cx, cy, 17, 0, TAU); g.fill();
        g.strokeStyle = U.rgba(th.neon, 0.6);
        g.lineWidth = 1;
        g.beginPath(); g.arc(cx, cy, 17, 0, TAU); g.stroke();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          g.fillStyle = i % 3 === 0 ? U.rgba(th.neon, 0.7) : 'rgba(150,180,210,0.4)';
          g.fillRect(cx + Math.cos(a) * 14 - 1, cy + Math.sin(a) * 14 - 1, 2, 2);
        }
        g.strokeStyle = '#dfeaff';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 4, cy - 8); g.stroke();
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - 7, cy + 2); g.stroke();
        g.fillStyle = th.accent;
        g.fillRect(cx - 1, cy - 1, 2, 2);
      };
      // exit sign
      const drawExit = (x, y) => {
        g.fillStyle = '#07130c';
        g.fillRect(x - 22, y - 11, 44, 22);
        g.fillStyle = '#1c5c34';
        g.fillRect(x - 20, y - 9, 40, 18);
        g.fillStyle = '#8dffb0';
        g.font = 'bold 9px Consolas';
        g.textAlign = 'center';
        g.fillText('EXIT', x + 6, y + 3);
        // running man
        g.fillStyle = '#c6ffd8';
        g.fillRect(x - 15, y - 4, 2, 2);
        g.fillRect(x - 14, y - 1, 2, 4);
        g.fillRect(x - 17, y + 1, 3, 1);
        g.fillRect(x - 12, y + 1, 3, 1);
        g.fillRect(x - 16, y + 3, 2, 4);
        g.fillRect(x - 12, y + 3, 2, 4);
      };
      // poster
      const drawPoster = (x, y, w, h) => {
        if (G.roughGen) {
          const shape = G.roughGen.rectangle(x, y, w, h, { stroke: U.rgba(th.accent, 0.55), strokeWidth: 1.4, roughness: 1.1, seed: this.seed % 999 });
          G.Rough.drawShape(g, shape);
        }
        g.fillStyle = U.rgba(th.accent, 0.06);
        g.fillRect(x, y, w, h);
        g.fillStyle = U.rgba(th.accent, 0.65);
        g.font = 'bold 9px Consolas';
        g.textAlign = 'left';
        const lines = th.id === 'pantry' ? ['COFFEE', 'IS A', 'HUMAN RIGHT'] : th.id === 'meeting' ? ['SYNERGY', '> SLEEP'] : ['NO', 'OVERTIME', '(LOL)'];
        lines.forEach((l, i) => g.fillText(l, x + 6, y + 13 + i * 10));
        g.fillStyle = U.rgba(th.neon, 0.4);
        g.fillRect(x + 5, y + h - 8, w * 0.5, 2);
        // doodle
        g.strokeStyle = U.rgba(th.neon, 0.35);
        g.beginPath();
        g.moveTo(x + w - 16, y + 10);
        g.lineTo(x + w - 6, y + 20);
        g.lineTo(x + w - 16, y + 30);
        g.stroke();
      };
      // logo
      const drawLogo = (cx, cy) => {
        g.save();
        g.globalAlpha = 0.13;
        g.fillStyle = th.neon;
        g.font = '900 44px Arial Black, Arial';
        g.textAlign = 'center';
        g.fillText('∞', cx, cy);
        g.font = 'bold 9px Consolas';
        g.fillText('INFINITY CORP.', cx, cy + 15);
        g.restore();
      };
      // screen
      const drawScreen = (x, y, w, h) => {
        g.fillStyle = '#05080e';
        g.fillRect(x - 3, y - 3, w + 6, h + 6);
        g.fillStyle = '#0d1420';
        g.fillRect(x, y, w, h);
        const sg = g.createLinearGradient(x, y, x, y + h);
        sg.addColorStop(0, U.rgba(th.neon, 0.3));
        sg.addColorStop(1, U.rgba(th.neon, 0.05));
        g.fillStyle = sg;
        g.fillRect(x, y, w, h);
        g.fillStyle = U.rgba(th.neon, 0.6);
        g.font = 'bold 8px Consolas';
        g.fillText('Q4 TARGETS', x + 7, y + 13);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = 0; i < 4; i++) g.fillRect(x + 8, y + 19 + i * 5, w * (0.3 + rnd() * 0.5), 2);
        g.fillStyle = U.rgba(th.accent, 0.6);
        g.fillRect(x + 8, y + 19, w * 0.6, 2);
      };
      // fixed slots keep the wall readable and never overlap
      drawClock(80, 40);
      drawExit(866, 40);
      if (th.id === 'meeting') {
        drawScreen(434, 18, 148, 50);
      } else if (th.id === 'pantry') {
        const spot = 508;
        g.fillStyle = '#0a0d10';
        g.fillRect(spot - 44, 15, 88, 54);
        g.fillStyle = '#1c1a14';
        g.fillRect(spot - 42, 17, 84, 50);
        g.fillStyle = U.rgba(th.neon, 0.8);
        g.font = 'bold 8px Consolas';
        g.textAlign = 'center';
        g.fillText('TODAY', spot, 29);
        g.fillStyle = 'rgba(255,240,220,0.55)';
        g.font = '7px Consolas';
        g.fillText('COFFEE ... 3', spot, 41);
        g.fillText('REGRET ... 0', spot, 51);
        g.fillText('SLEEP ... -1', spot, 61);
      } else {
        drawLogo(508, 46);
      }
      if (th.id !== 'exec') drawPoster(128, 22, 56, 42);
      // wall stains / grime
      for (let i = 0; i < 20; i++) {
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(60 + rnd() * 840, 10 + rnd() * 60, 3 + rnd() * 12, 1 + rnd() * 3);
      }
      // hanging wires
      g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(520, 0);
      g.bezierCurveTo(525, 20, 515, 40, 522, 58);
      g.stroke();
    }

    drawLamps(g) {
      const th = this.theme;
      this.lamps = [];
      const n = 4;
      for (let i = 0; i < n; i++) {
        const x = 130 + i * 234;
        const y = 74;
        this.lamps.push({ x, y, flicker: this.rnd() });
        // fixture
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(x - 22, y - 4, 44, 5);
        g.fillStyle = '#c9d6e4';
        g.fillRect(x - 20, y - 2, 40, 3);
        g.fillStyle = U.rgba(th.lamp, 0.95);
        g.fillRect(x - 18, y + 1, 36, 2);
        // light cone
        const cone = g.createLinearGradient(x, y, x, 460);
        cone.addColorStop(0, U.rgba(th.lamp, 0.2));
        cone.addColorStop(0.4, U.rgba(th.lamp, 0.07));
        cone.addColorStop(1, U.rgba(th.lamp, 0));
        g.fillStyle = cone;
        g.beginPath();
        g.moveTo(x - 20, y + 2);
        g.lineTo(x + 20, y + 2);
        g.lineTo(x + 150, 480);
        g.lineTo(x - 150, 480);
        g.closePath();
        g.fill();
        // floor pool
        const pool = g.createRadialGradient(x, 260, 10, x, 260, 190);
        pool.addColorStop(0, U.rgba(th.lamp, 0.15));
        pool.addColorStop(0.6, U.rgba(th.lamp, 0.04));
        pool.addColorStop(1, U.rgba(th.lamp, 0));
        g.fillStyle = pool;
        g.beginPath();
        g.ellipse(x, 280, 190, 130, 0, 0, TAU);
        g.fill();
      }
    }

    drawFloorDeco(g) {
      const rnd = U.rng(this.seed + 991);
      const th = this.theme;
      // ghosted company mark on the rug
      g.save();
      g.globalAlpha = 0.05;
      g.fillStyle = th.neon;
      g.textAlign = 'center';
      g.font = '900 150px Arial Black, Arial';
      g.fillText('∞', 480, 355);
      g.font = 'bold 11px Consolas';
      g.fillText('INFINITY CORP. / NO ONE LEAVES BEFORE 00:00', 480, 388);
      g.restore();
      // pool of light in the middle of the room
      const sheen = g.createRadialGradient(480, 290, 20, 480, 290, 420);
      sheen.addColorStop(0, U.rgba(th.lamp, 0.07));
      sheen.addColorStop(1, U.rgba(th.lamp, 0));
      g.fillStyle = sheen;
      g.fillRect(0, FLOOR_Y, 960, 540 - FLOOR_Y);
      // coffee stains
      for (let i = 0; i < 7; i++) {
        const x = 90 + rnd() * 780;
        const y = 150 + rnd() * 350;
        const r = 6 + rnd() * 18;
        g.fillStyle = th.id === 'pantry' ? 'rgba(70,40,20,0.28)' : 'rgba(30,40,60,0.3)';
        g.beginPath();
        g.ellipse(x, y, r, r * 0.42, rnd() * 3, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.14)';
        g.beginPath();
        g.ellipse(x + 2, y + 1, r * 0.6, r * 0.26, 0, 0, TAU);
        g.fill();
      }
      // scattered paper
      for (let i = 0; i < 12; i++) {
        const x = 80 + rnd() * 800;
        const y = 140 + rnd() * 360;
        g.save();
        g.translate(x, y);
        g.rotate(rnd() * TAU);
        g.fillStyle = 'rgba(232,226,208,0.55)';
        g.fillRect(-7, -5, 14, 10);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(-7, -5, 14, 1);
        g.fillRect(-5, -2, 8, 1);
        g.restore();
      }
      // safety tape scraps (rough)
      if (G.roughGen) {
        for (let i = 0; i < 3; i++) {
          const y = 210 + rnd() * 240;
          const x0 = 120 + rnd() * 600;
          const len = 46 + rnd() * 70;
          const pts = [[x0, y], [x0 + len * 0.5, y + 2], [x0 + len, y - 1]];
          const shape = G.roughGen.linearPath(pts, { stroke: 'rgba(255,196,60,0.16)', strokeWidth: 3, roughness: 1.4, seed: (this.seed + i * 7) % 999 });
          G.Rough.drawShape(g, shape);
        }
        // cracks
        for (let i = 0; i < 3; i++) {
          const sx = 100 + rnd() * 760;
          const sy = 150 + rnd() * 330;
          const pts = [[sx, sy]];
          let cx = sx, cy = sy;
          for (let k = 0; k < 4; k++) {
            cx += (rnd() - 0.5) * 60;
            cy += rnd() * 30;
            pts.push([cx, cy]);
          }
          const shape = G.roughGen.linearPath(pts, { stroke: 'rgba(0,0,0,0.35)', strokeWidth: 1.2, roughness: 1.6, seed: (this.seed + 31 * i) % 999 });
          G.Rough.drawShape(g, shape);
        }
      }
      // glow strips near walls
      g.fillStyle = U.rgba(th.neon, 0.05);
      g.fillRect(0, FLOOR_Y, 5, 540 - FLOOR_Y);
      g.fillRect(955, FLOOR_Y, 5, 540 - FLOOR_Y);
    }

    makeMotes() {
      const rnd = U.rng(this.seed + 501);
      this.motes = [];
      for (let i = 0; i < 46; i++) {
        this.motes.push({
          x: rnd() * 960, y: FLOOR_Y + rnd() * 420,
          vx: (rnd() - 0.5) * 8, vy: -4 - rnd() * 10,
          s: rnd() < 0.7 ? 1 : 2, a: 0.15 + rnd() * 0.35, ph: rnd() * 10,
        });
      }
      this.papers = [];
      for (let i = 0; i < 3; i++) {
        this.papers.push({
          x: rnd() * 960, y: rnd() * 380, vx: (rnd() - 0.5) * 5, vy: 4 + rnd() * 7,
          w: 5 + rnd() * 4, h: 4 + rnd() * 3, rot: rnd() * TAU, vr: (rnd() - 0.5) * 1.1, a: 0.1 + rnd() * 0.12,
        });
      }
    }

    // ---------------- waves ----------------
    start() {
      this.phase = 'pre';
      this.timer = 1.0;
      this.spawnQueue = [];
      this.waveIndex = 0;
      G.Audio.setMood(this.index >= 6 ? 'boss' : 'battle');
    }

    beginWave() {
      const w = this.waves[this.waveIndex];
      if (!w) { this.checkCleared(); return; }
      const count = Math.ceil(w.count * (1 + this.index * 0.05));
      for (let i = 0; i < count; i++) {
        const type = w.eliteWave ? 'supervisor' : w.pool[(this.rnd() * w.pool.length) | 0];
        this.spawnQueue.push({ type, delay: i * 0.18 + (w.eliteWave ? 0 : 0.15) });
      }
      this.spawnTimer = 0;
      this.phase = 'fight';
      this.game.hudWave(this.waveIndex + 1, this.waves.length);
      if (this.waveIndex === 0) {
        this.game.toast(this.index === 0 ? '清空这一层。活下去。' : '异常出现', this.index === 0 ? 'gold' : 'pink');
      }
    }

    update(dt) {
      this.t += dt;
      this.ambientT += dt;
      // motes
      for (const m of this.motes) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.y < FLOOR_Y - 10 || m.x < -10 || m.x > 970) {
          m.y = 520; m.x = Math.random() * 960;
        }
      }
      for (const p of this.papers) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.y > 540) { p.y = -10; p.x = Math.random() * 960; }
        if (p.x < -20) p.x = 970;
        if (p.x > 980) p.x = -10;
      }
      if (this.phase === 'pre') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.beginWave();
        }
      } else if (this.phase === 'fight') {
        this.spawnTimer += dt;
        while (this.spawnQueue.length && this.spawnQueue[0].delay <= this.spawnTimer) {
          const s = this.spawnQueue.shift();
          const p = this.game.findSpawnPoint();
          this.game.spawnEnemy(s.type, p.x, p.y, { hpMul: this.hpMul, spawnFx: true, speedMul: this.speedMul });
          FX.ring(p.x, p.y, 4, 34, '#ff3d5e', 0.35, 2);
          G.Audio.play('spawn');
        }
        if (!this.spawnQueue.length && this.game.enemies.length === 0) {
          if (this.waveIndex < this.waves.length - 1) {
            this.waveIndex++;
            this.phase = 'pre';
            this.timer = 1.05;
            this.game.hudWave(this.waveIndex + 1, this.waves.length);
            this.game.toast('下一波', 'pink');
          } else {
            this.onCleared();
          }
        }
      }
      for (const o of this.obstacles) if (o.flash > 0) o.flash = Math.max(0, o.flash - dt);
      this.obstacles = this.obstacles.filter((o) => !o.dead);
      // rooftop storm
      if (this.index >= 6) {
        this.rainT -= dt;
        if (this.rainT <= 0) {
          this.rainT = 0.035;
          for (let i = 0; i < 3; i++) {
            this.rain.push({ x: U.rand(-20, 980), y: U.rand(-30, 0), vx: U.rand(-90, -35), vy: U.rand(620, 820), len: U.rand(10, 22) });
          }
        }
        for (const r of this.rain) { r.x += r.vx * dt; r.y += r.vy * dt; }
        this.rain = this.rain.filter((r) => r.y < 570);
        this.lightningT -= dt;
        if (this.lightningT <= 0) {
          this.lightningT = 6 + Math.random() * 8;
          FX.flash('white');
          FX.shake(3, 0.2);
          G.Audio.play('thunder');
        }
      }
      // doors pulse
      for (const d of this.doors) d.t += dt;
    }

    onCleared() {
      if (this.cleared) return;
      this.cleared = true;
      this.phase = 'cleared';
      this.game.hudWave(0, 0);
      this.game.clearEnemyBullets();
      this.game.roomCleared(this);
    }

    // ---------------- doors & interactables ----------------
    spawnDoors(types) {
      const positions = [{ side: 'left', x: 58, y: 420 }, { side: 'right', x: 902, y: 420 }];
      types.forEach((type, i) => {
        const d = G.DATA.doors[type];
        const pos = positions[i];
        const door = {
          type, side: pos.side, x: pos.x, y: pos.y, r: 30, t: 0,
          color: d.color, icon: d.icon, name: d.name, en: d.en,
          shapes: [],
        };
        for (let s = 0; s < 3; s++) {
          door.shapes.push(G.roughGen ? G.roughGen.ellipse(door.x, door.y - 40, 64, 100, {
            stroke: d.color, strokeWidth: 2.2, roughness: 1.8, seed: (this.seed + i * 13 + s * 31) % 999,
          }) : null);
        }
        this.doors.push(door);
        const p = this.game.findSpawnPointNear(door.x, door.y);
        for (let k = 0; k < 10; k++) {
          FX.add({ type: 'spark', x: door.x + U.rand(-14, 14), y: door.y + U.rand(-30, 20), vx: U.rand(-10, 10), vy: -U.rand(20, 70), size: U.rand(1, 2), life: U.rand(0.5, 1.2), color: d.color, drag: 0.98, glow: true });
        }
      });
      G.Audio.play('door');
    }

    spawnBossDoor() {
      const door = {
        type: 'boss', side: 'right', x: 902, y: 420, r: 32, t: 0,
        color: '#ff3d5e', icon: 'crown', name: '天台', en: 'FINAL',
        shapes: [],
      };
      for (let s = 0; s < 3; s++) {
        door.shapes.push(G.roughGen ? G.roughGen.ellipse(door.x, door.y - 40, 68, 106, { stroke: '#ff3d5e', strokeWidth: 2.6, roughness: 2, seed: (this.seed + 99 + s * 17) % 999 }) : null);
      }
      this.doors.push(door);
      G.Audio.play('boss');
    }

    addChest(x, y) {
      const ob = { type: 'chest', x: x - 22, y: y - 20, w: 44, h: 34, seed: 5, solid: true, opened: false, interact: 'chest' };
      this.obstacles.push(ob);
      this.chest = ob;
      this.interactable = ob;
      FX.ring(x, y - 16, 4, 46, '#ffd24a', 0.6, 2);
    }

    addVending(x, y) {
      const ob = { type: 'vending', x: x - 25, y: y - 44, w: 50, h: 42, seed: 8, solid: true, interact: 'shop' };
      this.obstacles.push(ob);
      this.vending = ob;
      this.interactable = ob;
      G.Audio.play('ui2');
    }

    // ---------------- drawing ----------------
    drawBackdrop(ctx) {
      if (this.bg) ctx.drawImage(this.bg, 0, 0, 960, 540);
      // window rain
      const t = this.t;
      for (const w of this.windows) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(w.x, w.y, w.w, w.h);
        ctx.clip();
        ctx.strokeStyle = 'rgba(160,220,255,0.16)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 26; i++) {
          const rx = w.x + ((i * 37 + t * 100) % w.w);
          const ry = w.y + ((i * 23 + t * 260) % w.h);
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 3, ry + 9);
          ctx.stroke();
        }
        ctx.restore();
      }
      // lamp flicker overlay
      for (const l of this.lamps) {
        const fl = Math.sin(t * (3 + l.flicker * 4) + l.flicker * 10);
        const on = fl > -0.85 ? 1 : 0.35;
        if (on < 1) {
          ctx.save();
          ctx.globalAlpha = 0.35;
          U.glow(ctx, l.x, l.y + 4, 46, this.theme.lamp, 0.3);
          ctx.restore();
        }
      }
      // motes
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const m of this.motes) {
        ctx.globalAlpha = m.a * (0.6 + Math.sin(t * 2 + m.ph) * 0.4);
        ctx.fillStyle = this.theme.lamp;
        ctx.fillRect(m.x, m.y, m.s, m.s);
      }
      ctx.restore();
      // falling papers
      ctx.save();
      for (const p of this.papers) {
        ctx.globalAlpha = p.a;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = '#e6e0cf';
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, 1);
        ctx.restore();
      }
      ctx.restore();
      // fog
      ctx.save();
      ctx.fillStyle = this.theme.fog;
      ctx.fillRect(0, FLOOR_Y, 960, 540 - FLOOR_Y);
      ctx.restore();
    }

    drawZones(ctx) {
      if (G.Exploration) G.Exploration.drawTerminal(ctx, this);
    }

    drawDoors(ctx) {
      for (const d of this.doors) {
        const t = d.t;
        const near = this.game.player && U.dist(this.game.player.x, this.game.player.y, d.x, d.y) < 90;
        const col = d.color;
        ctx.save();
        // ground glow
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, 90);
        g.addColorStop(0, U.rgba(col, near ? 0.3 : 0.18));
        g.addColorStop(1, U.rgba(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, 60, 28, 0, 0, TAU);
        ctx.fill();
        ctx.restore();

        // light column
        ctx.save();
        const grad = ctx.createLinearGradient(0, d.y - 100, 0, d.y + 8);
        grad.addColorStop(0, U.rgba(col, 0));
        grad.addColorStop(0.6, U.rgba(col, 0.09));
        grad.addColorStop(1, U.rgba(col, 0.18));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y - 46, 34, 60, 0, 0, TAU);
        ctx.fill();
        ctx.restore();

        // rough portal ring
        const shape = d.shapes[Math.floor(t * 6) % 3];
        if (shape) {
          ctx.save();
          ctx.globalAlpha = near ? 1 : 0.8;
          ctx.shadowColor = col;
          ctx.shadowBlur = 10;
          G.Rough.drawShape(ctx, shape);
          ctx.restore();
        }
        // inner glow ring
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.rgba(col, near ? 0.85 : 0.5);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y - 40, 27 + Math.sin(t * 4) * 1.4, 44, 0, 0, TAU);
        ctx.stroke();
        // particles rising
        for (let i = 0; i < 5; i++) {
          const yy = ((t * 40 + i * 22) % 74);
          const xx = d.x + Math.sin(t * 2 + i) * 12;
          ctx.fillStyle = U.rgba(col, 0.7 * (1 - yy / 74));
          ctx.fillRect(xx, d.y - 12 - yy, 2, 3);
        }
        ctx.restore();

        // icon plate
        ctx.save();
        ctx.fillStyle = 'rgba(4,8,14,0.8)';
        ctx.fillRect(d.x - 18, d.y - 74, 36, 28);
        ctx.strokeStyle = U.rgba(col, 0.45);
        ctx.lineWidth = 1;
        ctx.strokeRect(d.x - 18, d.y - 74, 36, 28);
        SP.drawIcon(ctx, d.icon, d.x - 10, d.y - 68, 20, col);
        ctx.restore();

        // label
        ctx.save();
        ctx.fillStyle = 'rgba(3,7,12,0.75)';
        ctx.fillRect(d.x - 38, d.y + 8, 76, 18);
        ctx.fillStyle = U.rgba(col, 0.9);
        ctx.font = 'bold 8px Consolas';
        ctx.textAlign = 'center';
        ctx.fillText(d.en, d.x, d.y + 20);
        ctx.restore();

        if (near) {
          ctx.save();
          ctx.globalAlpha = 0.55 + Math.sin(t * 5) * 0.2;
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(d.x, d.y, 44, 20, 0, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      }
      if (G.Exploration) G.Exploration.drawDoorHints(ctx, this);
    }

    drawInteractHint(ctx) {
      const ob = this.interactable;
      if (!ob || this.phase !== 'cleared') return;
      if (!this.game.player) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      U.glow(ctx, ob.x + ob.w / 2, ob.y + ob.h / 2, 60, '#ffd24a', 0.12 + Math.sin(this.t * 3) * 0.04);
      ctx.restore();
    }

    drawEdges(ctx) {
      // subtle side vignette inside room
      const lg = ctx.createLinearGradient(0, 0, 60, 0);
      lg.addColorStop(0, 'rgba(0,0,0,0.5)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, FLOOR_Y, 60, 540 - FLOOR_Y);
      const rg = ctx.createLinearGradient(960, 0, 900, 0);
      rg.addColorStop(0, 'rgba(0,0,0,0.5)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(900, FLOOR_Y, 60, 540 - FLOOR_Y);
    }

    drawRain(ctx) {
      if (!this.rain || !this.rain.length) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(170, 210, 255, 0.22)';
      ctx.lineWidth = 1;
      for (const r of this.rain) {
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - r.vx * 0.018, r.y - r.len);
        ctx.stroke();
      }
      ctx.restore();
    }

    isBlocked(x, y, r) {
      for (const o of this.obstacles) {
        if (o.solid === false || o.dead) continue;
        if (o.interact) continue;
        if (U.circleRect(x, y, r, o)) return true;
      }
      return false;
    }
  }

  World.WALL_H = WALL_H;
  G.World = World;
})();
