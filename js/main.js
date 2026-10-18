/* ============================================================
   main.js — boot, rough.js bridge, first frame
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;

  function buildPath(ctx, ops) {
    ctx.beginPath();
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const d = op.data;
      if (op.op === 'move') ctx.moveTo(d[0], d[1]);
      else if (op.op === 'lineTo') ctx.lineTo(d[0], d[1]);
      else if (op.op === 'bcurveTo') ctx.bezierCurveTo(d[0], d[1], d[2], d[3], d[4], d[5]);
    }
  }

  function drawShape(ctx, shape) {
    if (!shape || !shape.sets) return;
    const o = shape.options || {};
    for (let i = 0; i < shape.sets.length; i++) {
      const set = shape.sets[i];
      ctx.save();
      if (set.type === 'path') {
        if (o.stroke && o.stroke !== 'none') {
          ctx.strokeStyle = o.stroke;
          ctx.lineWidth = o.strokeWidth || 1;
          if (o.strokeLineDash) ctx.setLineDash(o.strokeLineDash);
          buildPath(ctx, set.ops);
          ctx.stroke();
        }
      } else if (set.type === 'fillPath') {
        ctx.fillStyle = o.fill || '#000';
        buildPath(ctx, set.ops);
        ctx.fill();
      } else if (set.type === 'fillSketch') {
        ctx.strokeStyle = o.fill || '#000';
        ctx.lineWidth = o.fillWeight && o.fillWeight > 0 ? o.fillWeight : (o.strokeWidth || 1) / 2;
        buildPath(ctx, set.ops);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function setBoot(pct, text) {
    const bar = document.getElementById('boot-bar');
    const log = document.getElementById('boot-log');
    if (bar) bar.style.width = pct + '%';
    if (log && text) log.textContent = text;
  }

  function start() {
    // rough.js bridge
    if (window.rough) {
      G.roughGen = window.rough.generator();
      G.Rough = { drawShape: drawShape };
    } else {
      console.warn('rough.js not loaded');
      G.roughGen = null;
      G.Rough = { drawShape: function () {} };
    }

    const canvas = document.getElementById('game');
    let bootP = 8;
    setBoot(bootP, '正在接入公司内网…');
    const bootTimer = setInterval(() => {
      bootP = Math.min(88, bootP + 4 + Math.random() * 7);
      setBoot(bootP, bootP < 40 ? '正在接入公司内网…' : bootP < 70 ? '正在唤醒 24F 的异常…' : '正在加载员工手册…');
    }, 140);

    const finish = () => {
      clearInterval(bootTimer);
      setBoot(100, '欢迎回来。今天也要加班吗？');
      const game = new G.Game(canvas);
      G.game = game;
      game.init();
      setTimeout(() => {
        G.UI.hideBoot();
        if (game.state === 'menu') {
          G.UI.showScreen('menu');
          G.UI.refreshMenu();
        }
      }, 550);
      // expose a small debug surface for automated visual checks
      window.__OVERTIME = {
        game,
        start(char, weapon) { game.startRun(char || 'abigail', weapon || 'laser'); },
        give(n) { game.addXp(n || 200); },
        relic() { game.grantRelicChoice(); },
        killAll() { for (const e of game.enemies) game.killEnemy(e); game.enemies = []; },
        roomClear() { if (game.world) game.world.onCleared(); },
        boss() {
          game.pendingLevels = 0; game.choiceOpen = false;
          if (G.UI) G.UI.closeChoice();
          game.enterRoom(6, 'boss');
        },
        room(i) {
          game.pendingLevels = 0; game.choiceOpen = false;
          if (G.UI) G.UI.closeChoice();
          game.enterRoom(i, 'battle');
          if (G.UI) G.UI.showRoomIntro(i);
        },
        win() { if (game.boss) game.bossDefeated(game.boss); },
        die() {
          game.pendingLevels = 0; game.choiceOpen = false;
          if (G.UI) G.UI.closeChoice();
          game.state = 'play';
          if (game.player) { game.player.invuln = 0; game.player.takeDamage(99999, {}); }
        },
        gold(n) { game.run.gold += n || 200; },
        level(n) { for (let i = 0; i < (n || 3); i++) { game.run.level++; game.pendingLevels++; } game.openLevelUp(); },
        state() { return game.state; },
        choose(i) { G.UI.pickChoice(i == null ? 0 : i); },
      };
    };

    const fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    const timeout = new Promise((res) => setTimeout(res, 2200));
    Promise.race([fonts, timeout]).then(() => {
      G.Sprites.loadAssets(() => {
        setBoot(96, '正在加载员工手册…');
        finish();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
