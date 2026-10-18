/* Challenge rules and lifecycle: no external dependencies, normal saves retained. */
(function () {
  'use strict';
  const G = window.G;
  const rules = {
    normal: { id: 'normal', name: '普通加班', reward: 1, healing: 1, revive: true, xp: true, timeLimit: 0, bosses: 0 },
    sprint: { id: 'sprint', name: 'KPI 冲刺', en: 'DEADLINE SPRINT', icon: 'clock', reward: 1.5, healing: 1, revive: true, xp: true, timeLimit: 480, bosses: 0,
      desc: '8 分钟内走完六个房间并击败 KPI-0。暂停和选卡不计时，超时即失败。', risk: '时间有限 · 每条路线都计时', prize: '绩效点 ×1.5；胜利每剩余 30 秒再获 1 点' },
    iron: { id: 'iron', name: '铁人合同', en: 'IRON CONTRACT', icon: 'shield', reward: 2, healing: 0.25, revive: false, xp: true, timeLimit: 0, bosses: 0,
      desc: '治疗效果仅 25%，复活无效。护盾正常；生命上限升级附带的回复同样受限。死亡直接结算。', risk: '治疗受限 · 无法复活', prize: '绩效点 ×2' },
    gauntlet: { id: 'gauntlet', name: 'Boss 连审', en: 'TRIPLE REVIEW', icon: 'crown', reward: 1.75, healing: 1, revive: true, xp: false, timeLimit: 0, bosses: 3,
      hpScales: [0.5, 0.75, 1], initialDamage: 1.25,
      desc: '连续面对三场 KPI-0（50% / 75% / 100% 生命），开局伤害 +25%。每场后仅选一次升级；无经验升级。', risk: '连续审查 · 技能冷却和热量跨场保留', prize: '每场补给 15% 生命；绩效点 ×1.75' },
  };
  const M = G.Modes = {
    rules,
    forRun(run) { return rules[run && run.mode] || rules.normal; },
    init(run, id) {
      run.mode = rules[id] ? id : 'normal';
      run.bossRound = 0;
      run.failureReason = '';
      const r = this.forRun(run);
      run.stats.damage *= r.initialDamage || 1;
    },
    firstRoom(run) { return this.forRun(run).bosses ? 6 : 0; },
    healAmount(run, amount) { return Math.max(0, amount) * this.forRun(run).healing; },
    canRevive(run) { return this.forRun(run).revive; },
    applyItem(run, item) {
      const hp = run.hp;
      item.apply(run);
      if (run.hp > hp) run.hp = hp + this.healAmount(run, run.hp - hp);
      if (!this.canRevive(run)) run.stats.revive = 0;
    },
    bossSetup(game) {
      const r = this.forRun(game.run);
      if (r.bosses) {
        const scale = r.hpScales[game.run.bossRound];
        game.boss.hpMax *= scale;
        game.boss.hp = game.boss.hpMax;
      }
      const supply = r.bosses ? 0.15 : 0.5;
      game.healPlayer(game.run.maxHp * supply, true);
      game.run.shield = Math.max(game.run.shield, 15);
      game.toast('天台补给 · 回复 ' + Math.round(supply * r.healing * 100) + '% 生命 · 护盾 15', 'gold');
    },
    bossDefeated(game, boss) {
      const r = this.forRun(game.run);
      if (!r.bosses) return false;
      game.run.bossRound++;
      game.run.roomsCleared = game.run.bossRound;
      if (game.run.bossRound >= r.bosses) return false;
      boss.dead = true;
      game.state = 'levelup';
      game.choiceOpen = true;
      game.timers.length = 0;
      game.enemies.length = 0;
      game.bullets.length = 0;
      game.slamZones.length = 0;
      G.FX.clear();
      G.UI.showChoice({ type: 'boss-upgrade', eyebrow: 'REVIEW ' + game.run.bossRound + ' / ' + r.bosses,
        title: '审查间歇', sub: '只签一项补充条款。选择后进入下一场；冷却与热量保留。',
        items: G.DATA.rollUpgrades(game.run, 3, ['rare', 'epic']), reroll: false });
      return true;
    },
    pickBossUpgrade(game, item) {
      if (!game.choiceOpen || G.UI.choice?.type !== 'boss-upgrade') return;
      this.applyItem(game.run, item);
      game.run.upgrades.push(item);
      game.run.upgradeCounts[item.id] = (game.run.upgradeCounts[item.id] || 0) + 1;
      game.choiceOpen = false;
      G.UI.closeChoice();
      game.enterRoom(6, 'boss');
    },
    update(game) {
      const r = this.forRun(game.run);
      if (r.timeLimit && game.run.time >= r.timeLimit && game.canAct()) {
        game.run.time = r.timeLimit;
        game.run.failureReason = 'KPI 截止时间已到';
        game.player.dead = true;
        game.gameOver();
      }
    },
    points(run, win, score) {
      const r = this.forRun(run);
      const base = Math.max(3, Math.floor(score / 900) + (win ? 12 : 0));
      return Math.floor(base * r.reward) + (win && r.timeLimit ? Math.floor(Math.max(0, r.timeLimit - run.time) / 30) : 0);
    },
    hud(run) {
      const r = this.forRun(run);
      if (r.id === 'normal') return '';
      return r.name + (r.timeLimit ? ' · 剩余 ' + G.U.formatTime(r.timeLimit - run.time) : r.bosses ? ' · 第 ' + Math.min(r.bosses, run.bossRound + 1) + '/' + r.bosses + ' 审' : ' · 治疗 25%');
    },
    record(save, result) {
      if (!result.mode || result.mode === 'normal') return false;
      const all = save.challenges || (save.challenges = {});
      const b = all[result.mode] || (all[result.mode] = { runs: 0, wins: 0, score: 0, fastest: null });
      b.runs++;
      if (result.win) { b.wins++; b.fastest = b.fastest == null ? result.time : Math.min(b.fastest, result.time); }
      b.score = Math.max(b.score, result.score);
      b.last = { win: result.win, time: result.time, score: result.score };
      save.points += result.points;
      return true;
    },
  };
})();
