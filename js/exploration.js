/* ============================================================
   exploration.js — room terminals, optional risks and door intel
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;
  const RANGE = 80;
  const TAU = Math.PI * 2;

  const CONFIG = [
    {
      kind: 'terminal', color: '#57f4ff',
      title: '加班审批终端', eyebrow: 'ACCESS LOG / 1F-A',
      text: '打卡机旁多了一台没有登记的终端。屏幕上还开着你的加班审批页：申请时间 00:00，状态「自愿」，审批人一栏空白。',
      anchor: { x: 156, y: 118 },
      auditPool: ['paper', 'printer'],
      auditReward: 'relic',
    },
    {
      kind: 'email', color: '#b388ff',
      title: '财务群发邮件', eyebrow: 'UNREAD / PAYROLL',
      text: '标题是「本月工资发放说明」。正文重复了七遍「积分不可兑换」，附件却是一份员工互助物资清单，最后一行写着：别让行政看见。',
      anchor: { x: 786, y: 118 },
      auditPool: ['paper', 'drone'],
      auditReward: 'upgrade',
    },
    {
      kind: 'log', color: '#ffd24a',
      title: '会议纪要回收站', eyebrow: 'RECOVERED / MEETING',
      text: '已删除的纪要里，所有「加班费」都被替换成了「成长机会」。回收站还保留着修改记录，修改人叫 INFINITY_CORP。',
      anchor: { x: 132, y: 120 },
      auditPool: ['printer', 'ghost'],
      auditReward: 'relic',
    },
    {
      kind: 'terminal', color: '#57f4ff',
      title: '门禁审计控制台', eyebrow: 'SECURITY / FLOOR 2',
      text: '控制台显示今晚有 47 次下班尝试，全部被记为「主动放弃」。审计按钮上贴着一张便签：按下去，门会先替你关上。',
      anchor: { x: 804, y: 118 },
      auditPool: ['drone', 'paper', 'printer'],
      auditReward: 'upgrade',
    },
    {
      kind: 'email', color: '#ff8ca7',
      title: '老板的转发邮件', eyebrow: 'FORWARDED / VIP',
      text: '邮件只有一句「大家要有始有终」。发件时间 00:41，密送名单里却有每位员工的家庭住址。服务器在附件加载时发出了低鸣。',
      anchor: { x: 166, y: 122 },
      auditPool: ['zombie', 'drone', 'printer'],
      auditReward: 'relic',
    },
    {
      kind: 'log', color: '#8cffb0',
      title: '离职员工日志', eyebrow: 'LAST SHIFT / 3F-B',
      text: '日志最后一次保存于 00:40：「HR 让我把离职原因改成个人成长。我把真原因写在日志里。如果还有人看到，互助柜的备用磁卡在第三格。」',
      anchor: { x: 792, y: 122 },
      auditPool: ['zombie', 'ghost', 'drone'],
      auditReward: 'upgrade',
    },
  ];

  const DOOR_RISK = {
    battle: { level: 1, label: '常规风险', color: '#57f4ff' },
    elite: { level: 3, label: '高风险 · 精英', color: '#ffd24a' },
    treasure: { level: 0, label: '奖励路线', color: '#a6ff5e' },
    event: { level: 2, label: '未知风险', color: '#b388ff' },
    rest: { level: 1, label: '低风险 · 回复', color: '#a6ff5e' },
    shop: { level: 1, label: '低风险 · 补给', color: '#ff8ca7' },
    boss: { level: 3, label: '致命风险', color: '#ff3d5e' },
  };

  const E = (G.Exploration = {});
  E.RANGE = RANGE;
  E.CONFIG = CONFIG;

  function roomKey(index) {
    return 'room:' + index;
  }

  function centerOf(t) {
    return { x: t.x + t.w / 2, y: t.y + t.h / 2 };
  }

  function rectClear(world, rc) {
    for (const o of world.obstacles) {
      if (o.dead) continue;
      if (U.rectsOverlap(rc, o, 10)) return false;
    }
    return true;
  }

  function baseSpotClear(world, rc) {
    const c = { x: rc.x + rc.w / 2, y: rc.y + rc.h / 2 };
    if (c.x < 82 || c.x > 878 || c.y < 110 || c.y > 490) return false;
    if (U.dist(c.x, c.y, world.spawn.x, world.spawn.y) < 155) return false;
    if (U.dist(c.x, c.y, 58, 420) < 125 || U.dist(c.x, c.y, 902, 420) < 125) return false;
    if (U.dist(c.x, c.y, 480, 300) < 72) return false;
    return rectClear(world, { x: rc.x - 12, y: rc.y - 10, w: rc.w + 24, h: rc.h + 20 });
  }

  function spotClear(world, rc) {
    if (!baseSpotClear(world, rc)) return false;
    // Keep a readable standing area below the terminal for the 80px interaction range.
    const stance = { x: rc.x - 18, y: rc.y + rc.h + 4, w: rc.w + 36, h: 54 };
    return rectClear(world, stance);
  }

  function findSpot(world, cfg) {
    const w = 58, h = 50;
    const xs = [
      cfg.anchor.x,
      cfg.anchor.x < 480 ? cfg.anchor.x + 78 : cfg.anchor.x - 78,
      86, 142, 198, 762, 818, 874,
    ];
    const ys = [cfg.anchor.y, 116, 126, 136, 156, 176, 196, 216, 236];
    for (const y of ys) {
      for (const x0 of xs) {
        const x = Math.round(U.clamp(x0, 72, 960 - w - 72));
        const rc = { x, y, w, h };
        if (spotClear(world, rc)) return rc;
      }
    }
    // Dense furniture can consume the preferred slots. Scan the room before
    // relaxing only the standing-area check; overlap and route clearance stay hard.
    for (const y of ys) {
      for (let x = 72; x <= 960 - w - 72; x += 12) {
        const rc = { x, y, w, h };
        if (baseSpotClear(world, rc)) return rc;
      }
    }
    return { x: 84, y: 116, w, h };
  }

  E.attach = function (world) {
    if (!world || world.kind === 'boss' || world.index >= 6) return null;
    if (!world.game || !world.game.run) return null;
    const cfg = CONFIG[world.index % CONFIG.length];
    const spot = findSpot(world, cfg);
    const key = roomKey(world.index);
    const run = world.game.run;
    if (!run.explorationUsed) run.explorationUsed = Object.create(null);
    const used = !!run.explorationUsed[key];
    const terminal = {
      id: 'room-' + world.index + '-' + cfg.kind,
      type: 'terminal',
      kind: cfg.kind,
      color: cfg.color,
      roomIndex: world.index,
      roomKey: key,
      title: cfg.title,
      eyebrow: cfg.eyebrow,
      text: cfg.text,
      auditPool: cfg.auditPool.slice(),
      auditReward: cfg.auditReward,
      x: spot.x,
      y: spot.y,
      w: spot.w,
      h: spot.h,
      used,
      resolved: used ? run.explorationUsed[key] : null,
      audit: null,
      rewardGiven: false,
      goldReward: 22 + world.index * 7,
      supplyHeal: Math.min(0.24, 0.14 + world.index * 0.015),
      supplyShield: 8 + world.index * 2,
    };
    world.terminal = terminal;
    return terminal;
  };

  function claimTerminal(world, terminal, resolution) {
    if (!terminal || terminal.used) return false;
    terminal.used = true;
    terminal.resolved = resolution;
    const run = world.game && world.game.run;
    if (run) {
      if (!run.explorationUsed) run.explorationUsed = Object.create(null);
      run.explorationUsed[terminal.roomKey] = resolution;
    }
    return true;
  }

  function hasRelicPool(run) {
    if (!run || !G.DATA || !G.DATA.relics) return false;
    const owned = (run.relics || []).map((r) => r.id);
    return G.DATA.relics.some((r) => owned.indexOf(r.id) < 0);
  }

  function plannedAuditReward(run, terminal) {
    return terminal.auditReward === 'relic' && hasRelicPool(run) ? 'relic' : 'upgrade';
  }

  function lockDoors(world) {
    for (const d of world.doors) d.explorationLocked = true;
  }

  function unlockDoors(world) {
    for (const d of world.doors) d.explorationLocked = false;
  }

  function startAudit(game, world, terminal) {
    const run = game.run;
    const index = terminal.roomIndex;
    const count = Math.min(7, 3 + Math.floor(index / 2));
    const pool = terminal.auditPool.length ? terminal.auditPool : ['paper'];
    const rewardType = plannedAuditReward(run, terminal);
    terminal.audit = {
      active: true,
      elapsed: 0,
      total: count,
      remaining: count,
      rewardType,
      rewardGiven: false,
    };
    world.phase = 'locked';
    lockDoors(world);
    for (let i = 0; i < count; i++) {
      const type = pool[i % pool.length];
      const spawn = game.findSpawnPoint ? game.findSpawnPoint() : { x: 480, y: 170 };
      game.spawnEnemy(type, spawn.x, spawn.y, {
        hpMul: 0.96 + index * 0.055,
        spawnFx: true,
      });
    }
    game.toast('合规审计已启动 · 出口封锁 · 剩余 ' + count + ' 个异常', 'pink');
    G.Audio.play('spawn');
  }

  function openAuditReward(game, terminal) {
    const audit = terminal.audit;
    if (!audit || audit.rewardGiven) return;
    audit.rewardGiven = true;
    terminal.rewardGiven = true;
    if (audit.rewardType === 'relic' && hasRelicPool(game.run)) {
      game.grantRelicChoice();
    } else {
      game.grantUpgradeChoice(['rare', 'epic', 'legend']);
    }
  }

  function makeEvent(world, terminal) {
    const run = world.game.run;
    const rewardType = plannedAuditReward(run, terminal);
    const rewardText = rewardType === 'relic' ? '随机遗物' : '稀有以上升级';
    return {
      id: 'exploration-' + terminal.id,
      eyebrow: terminal.eyebrow,
      title: terminal.title,
      text: terminal.text,
      options: [
        {
          label: '备份加班证据',
          desc: '匿名保存考勤与审批记录。获得 ¥' + terminal.goldReward + '。',
          apply(runState, game) {
            if (!claimTerminal(world, terminal, 'evidence')) return;
            game.addGold(terminal.goldReward);
            game.toast('证据已脱敏备份 · 获得 ¥' + terminal.goldReward, 'gold');
            G.Audio.play('coin');
          },
        },
        {
          label: '开启合规审计',
          desc: '封锁出口，追加一波审计异常；清空后获得' + rewardText + '。',
          apply(runState, game) {
            if (!claimTerminal(world, terminal, 'audit')) return;
            startAudit(game, world, terminal);
          },
        },
        {
          label: '取走员工互助补给',
          desc: '回复 ' + Math.round(terminal.supplyHeal * 100) + '% 最大生命，并获得 ' + terminal.supplyShield + ' 护盾。',
          apply(runState, game) {
            if (!claimTerminal(world, terminal, 'supply')) return;
            const heal = Math.max(1, Math.round(runState.maxHp * terminal.supplyHeal));
            game.healPlayer(heal);
            game.addShield(terminal.supplyShield);
            game.toast('员工互助柜：生命与护盾补给', 'gold');
          },
        },
      ],
    };
  }

  E.target = function (game) {
    if (!game || !game.world || !game.player) return null;
    if (game.state !== 'play' && game.state !== 'cleared') return null;
    if (game.choiceOpen || (G.UI && G.UI.choice)) return null;
    const world = game.world;
    const terminal = world.terminal;
    if (!terminal || terminal.used || world.phase !== 'cleared') return null;
    // Let the original room reward/event finish before starting an optional audit.
    if (game.timers && game.timers.length) return null;
    const c = centerOf(terminal);
    const distance = U.dist(game.player.x, game.player.y, c.x, c.y);
    if (distance > RANGE) return null;
    return {
      type: 'terminal',
      data: terminal,
      label: '按 E 调查 · ' + terminal.title,
      distance,
    };
  };

  E.interact = function (game, target) {
    if (!game || !game.world || !G.UI || !G.UI.showEvent) return false;
    if (game.state !== 'play' && game.state !== 'cleared') return false;
    if (game.choiceOpen || G.UI.choice) return false;
    const world = game.world;
    if (world.phase !== 'cleared' || !world.terminal || world.terminal.used) return false;
    const data = target && target.data ? target.data : target;
    if (!data || data !== world.terminal) return false;
    if (!E.target(game)) return false;
    G.UI.showEvent(makeEvent(world, world.terminal), game);
    game.state = 'event';
    return true;
  };

  E.update = function (game, dt) {
    if (!game || !game.world) return;
    const world = game.world;
    const terminal = world.terminal;
    const audit = terminal && terminal.audit;
    if (!audit || !audit.active) return;
    audit.elapsed += Math.max(0, dt || 0);
    audit.remaining = (game.enemies || []).reduce((n, e) => n + (e && !e.dead ? 1 : 0), 0);
    if (audit.remaining > 0 || audit.elapsed < 0.2) return;
    // A level-up or event panel may already be open. Keep the exit sealed until
    // the reward panel can be shown, so the room cannot be abandoned mid-reward.
    if (game.state !== 'play' && game.state !== 'cleared') return;
    if (game.choiceOpen || (G.UI && G.UI.choice)) return;

    audit.active = false;
    unlockDoors(world);
    world.phase = 'cleared';
    game.toast('审计异常已清空 · 出口恢复', 'gold');
    G.Audio.play('levelup');
    openAuditReward(game, terminal);
  };

  E.drawTerminal = function (ctx, world) {
    const t = world && world.terminal;
    if (!t) return;
    const pulse = 0.65 + Math.sin(world.t * 3.2) * 0.18;
    const x = t.x, y = t.y, w = t.w, h = t.h;
    ctx.save();
    ctx.globalAlpha = t.used ? 0.48 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 5, w * 0.58, 9, 0, 0, TAU);
    ctx.fill();

    // Wall-fed kiosk with a small keyboard shelf.
    ctx.fillStyle = '#09111c';
    ctx.fillRect(x + 7, y + 5, w - 14, h - 8);
    ctx.strokeStyle = U.rgba(t.color, 0.72);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 7, y + 5, w - 14, h - 8);
    ctx.fillStyle = '#111d2b';
    ctx.fillRect(x + 11, y + 9, w - 22, 27);
    ctx.fillStyle = U.rgba(t.color, 0.14);
    ctx.fillRect(x + 12, y + 10, w - 24, 25);
    ctx.fillStyle = U.rgba(t.color, 0.72);
    ctx.fillRect(x + 15, y + 14, 15, 1);
    ctx.fillRect(x + 15, y + 18, w - 31, 1);
    ctx.fillRect(x + 15, y + 22, w - 37, 1);
    ctx.fillRect(x + 15, y + 26, w - 28, 1);

    if (t.kind === 'email') {
      ctx.strokeStyle = U.rgba(t.color, 0.9);
      ctx.strokeRect(x + 37, y + 14, 10, 7);
      ctx.beginPath();
      ctx.moveTo(x + 37, y + 14);
      ctx.lineTo(x + 42, y + 18);
      ctx.lineTo(x + 47, y + 14);
      ctx.stroke();
    } else if (t.kind === 'log') {
      ctx.fillStyle = U.rgba(t.color, 0.82);
      ctx.fillRect(x + 37, y + 13, 9, 2);
      ctx.fillRect(x + 37, y + 17, 7, 2);
      ctx.fillRect(x + 37, y + 21, 10, 2);
    } else {
      ctx.fillStyle = U.rgba(t.color, 0.92);
      ctx.fillRect(x + 40, y + 15, 2, 9);
      ctx.fillRect(x + 44, y + 15, 2, 5);
      ctx.fillRect(x + 48, y + 15, 2, 7);
    }

    ctx.fillStyle = '#1a2636';
    ctx.fillRect(x + 5, y + 37, w - 10, 9);
    ctx.fillStyle = U.rgba(t.color, 0.28);
    for (let i = 0; i < 7; i++) ctx.fillRect(x + 10 + i * 6, y + 40, 4, 2);
    ctx.fillStyle = U.rgba(t.color, pulse);
    ctx.fillRect(x + w - 13, y + h - 7, 2, 2);

    ctx.fillStyle = 'rgba(3,8,14,0.86)';
    ctx.fillRect(x, y - 12, w, 10);
    ctx.fillStyle = U.rgba(t.color, 0.9);
    ctx.font = 'bold 7px Consolas';
    ctx.textAlign = 'center';
    ctx.fillText(t.used ? 'ARCHIVED' : t.kind.toUpperCase(), x + w / 2, y - 4);
    ctx.restore();
  };

  E.draw = function (ctx, world) {
    if (!world || !world.terminal) return;
    const t = world.terminal;
    const game = world.game;
    if (!game) return;

    const audit = t.audit;
    if (audit && audit.active) {
      const remain = audit.remaining != null ? audit.remaining : (game.enemies || []).filter((e) => e && !e.dead).length;
      ctx.save();
      ctx.fillStyle = 'rgba(5,7,12,0.9)';
      ctx.fillRect(330, 98, 300, 26);
      ctx.strokeStyle = 'rgba(255,61,94,0.7)';
      ctx.strokeRect(330.5, 98.5, 299, 25);
      ctx.fillStyle = '#ff7c9b';
      ctx.font = 'bold 9px Consolas';
      ctx.textAlign = 'center';
      ctx.fillText('AUDIT LOCK  ·  审计异常 ' + remain + ' / ' + audit.total, 480, 115);
      ctx.restore();
    }

    if (t.used || world.phase !== 'cleared') return;
    const c = centerOf(t);
    const target = E.target(game);
    if (!target) return;
    const label = 'E  ' + t.title;
    ctx.font = 'bold 8px Consolas';
    const w = Math.max(128, ctx.measureText(label).width + 24);
    const x = U.clamp(c.x - w / 2, 8, 952 - w);
    const y = t.y - 34;
    ctx.save();
    ctx.fillStyle = 'rgba(4,9,15,0.92)';
    ctx.fillRect(x, y, w, 20);
    ctx.strokeStyle = U.rgba(t.color, 0.75 + Math.sin(world.t * 5) * 0.2);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 19);
    ctx.fillStyle = t.color;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + 13);
    ctx.restore();
  };

  E.drawDoorHints = function (ctx, world) {
    if (!world || !world.doors || !world.doors.length) return;
    const locked = world.phase === 'locked';
    for (const d of world.doors) {
      const desc = G.DATA.doors[d.type] ? G.DATA.doors[d.type].desc : '';
      const risk = DOOR_RISK[d.type] || DOOR_RISK.battle;
      const w = 184, h = 42;
      const x = d.side === 'left' ? Math.min(d.x + 22, 960 - w - 8) : Math.max(8, d.x - w - 22);
      const y = d.y + 31;
      const col = locked ? '#ff3d5e' : risk.color;
      ctx.save();
      ctx.fillStyle = 'rgba(3,7,12,0.88)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = U.rgba(col, locked ? 0.85 : 0.42);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.fillStyle = 'rgba(232,242,255,0.86)';
      ctx.font = '8px Consolas';
      ctx.textAlign = 'left';
      ctx.fillText(desc, x + 8, y + 14);
      ctx.fillStyle = locked ? '#ff7c9b' : risk.color;
      ctx.font = 'bold 8px Consolas';
      ctx.fillText(locked ? 'AUDIT LOCK · 清空审计异常' : risk.label, x + 8, y + 32);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < risk.level ? U.rgba(risk.color, 0.9) : 'rgba(150,170,200,0.16)';
        ctx.fillRect(x + w - 31 + i * 8, y + 25, 6, 6);
      }
      ctx.restore();
    }
  };
})();
