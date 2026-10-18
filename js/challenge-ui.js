/* Challenge menu and record presentation, reusing the existing game UI. */
(function () {
  'use strict';
  const G = window.G, UI = G.UI, M = G.Modes;
  const originalInit = UI.init;
  UI.init = function (game) {
    originalInit.call(this, game);
    document.getElementById('btn-challenges').addEventListener('click', () => this.openChallenges());
    document.getElementById('challenges-close').addEventListener('click', () => this.closeChallenges());
  };
  UI.openChallenges = function () {
    this.game.clearCombatInput();
    const wrap = document.getElementById('challenge-cards');
    wrap.replaceChildren();
    for (const r of Object.values(M.rules).filter(r => r.id !== 'normal')) {
      const best = G.Save.data.challenges?.[r.id];
      const card = document.createElement('button');
      card.className = 'contract-card';
      card.dataset.mode = r.id;
      card.innerHTML = '<span class="contract-code">' + r.en + '</span><h3>' + r.name + '</h3><p>' + r.desc + '</p><b>' + r.risk + '</b><p class="contract-prize">' + r.prize + '</p><small>' +
        (best ? '完成 ' + best.wins + '/' + best.runs + ' · 最佳绩效 ' + best.score + '<br>最快通关 ' + (best.fastest == null ? '尚未完成' : G.U.formatTime(best.fastest)) : '尚无独立记录') + '</small><strong>签订合同 →</strong>';
      card.addEventListener('click', () => {
        this.closeChallenges();
        this.beginRun(r.id);
      });
      wrap.appendChild(card);
    }
    document.getElementById('screen-challenges').hidden = false;
    this.modalOpen = true;
    G.Audio.play('ui2');
  };
  UI.closeChallenges = function () {
    document.getElementById('screen-challenges').hidden = true;
    this.modalOpen = false;
  };
  const closeTop = UI.closeTopModal;
  UI.closeTopModal = function () {
    if (!document.getElementById('screen-challenges').hidden) { this.closeChallenges(); return true; }
    return closeTop.call(this);
  };
  const hud = UI.updateHud;
  UI.updateHud = function (game, force) {
    hud.call(this, game, force);
    const el = document.getElementById('challenge-hud');
    const text = game.run ? M.hud(game.run) : '';
    el.hidden = !text;
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('urgent', !!game.run && M.forRun(game.run).timeLimit > 0 && M.forRun(game.run).timeLimit - game.run.time < 60);
  };
  const over = UI.showGameOver;
  UI.showGameOver = function (game, win) {
    over.call(this, game, win);
    const r = M.forRun(game.run);
    const art = document.getElementById('over-contract-art');
    art.hidden = r.id === 'normal';
    if (r.id !== 'normal') {
      const best = G.Save.data.challenges?.[r.id];
      document.getElementById('over-title').textContent = r.name + (win ? ' · 合同完成' : ' · 合同终止');
      document.getElementById('over-sub').textContent = (game.run.failureReason || (win ? '已完成全部目标' : '本次挑战失败')) + '。用时 ' + G.U.formatTime(game.run.time) + ' · 最快通关 ' + (best?.fastest == null ? '尚未完成' : G.U.formatTime(best.fastest)) + ' · 独立最佳绩效 ' + (best?.score || 0);
    }
  };
})();
