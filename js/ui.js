/* ============================================================
   ui.js — save data, menus, HUD, choice cards, codex, settings
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;
  const D = G.DATA;
  const SP = G.Sprites;
  const TAU = Math.PI * 2;

  // ============================================================
  // SAVE
  // ============================================================
  const KEY = 'overtime_save_v1';
  const DEFAULT_SAVE = () => ({
    version: 1,
    best: { score: 0, kills: 0, room: -1, time: 0 },
    runs: 0,
    wins: 0,
    points: 0,
    training: { vit: 0, eff: 0, luck: 0 },
    unlocked: { ama: false },
    seen: { enemies: [], weapons: [], relics: [] },
    seenStory: false,
    settings: { music: 0.5, sfx: 0.75, shake: true, autoAim: true, autoFire: false, autoMelee: false, reducedFx: false, crt: true, muted: false },
    totalKills: 0,
  });
  const Save = (G.Save = {
    data: null,
    _saveTimer: 0,
    load() {
      let d = null;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) d = JSON.parse(raw);
      } catch (e) { d = null; }
      const def = DEFAULT_SAVE();
      d = d || {};
      const out = Object.assign({}, def, d);
      out.best = Object.assign(def.best, d.best || {});
      out.training = Object.assign(def.training, d.training || {});
      out.unlocked = Object.assign(def.unlocked, d.unlocked || {});
      out.seen = Object.assign(def.seen, d.seen || {});
      out.settings = Object.assign(def.settings, d.settings || {});
      out.seen.enemies = out.seen.enemies || [];
      out.seen.weapons = out.seen.weapons || [];
      out.seen.relics = out.seen.relics || [];
      out.points = out.points || 0;
      out.runs = out.runs || 0;
      out.wins = out.wins || 0;
      out.totalKills = out.totalKills || 0;
      this.data = out;
      return out;
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {}
    },
    markSeen(type, id) {
      if (!this.data || !this.data.seen[type]) return;
      if (this.data.seen[type].indexOf(id) < 0) {
        this.data.seen[type].push(id);
        this.save();
      }
    },
    unlockCharacter(id) {
      if (!this.data) return;
      const c = D.characters.find((x) => x.id === id);
      if (c && c.unlocked) return;
      if (id === 'ama' && !this.data.unlocked.ama) {
        this.data.unlocked.ama = true;
        this.save();
        if (G.UI && G.UI.toast) G.UI.toast('新员工解锁：阿码 · 夜班程序员', 'gold');
      }
    },
    isUnlocked(id) {
      const c = D.characters.find((x) => x.id === id);
      if (c && c.unlocked) return true;
      if (id === 'ama') return !!this.data.unlocked.ama || this.data.best.room >= 2;
      return true;
    },
    recordRun(r) {
      const d = this.data;
      if (G.Modes.record(d, r)) { this.save(); return; }
      d.runs++;
      d.totalKills += r.kills;
      if (r.win) d.wins++;
      if (r.room >= 2) d.unlocked.ama = true;
      if (r.score > d.best.score) d.best.score = r.score;
      if (r.kills > d.best.kills) d.best.kills = r.kills;
      if (r.room > d.best.room) d.best.room = r.room;
      if (r.time > d.best.time) d.best.time = r.time;
      d.points += r.points || 0;
      this.save();
    },
    buyTraining(id) {
      const tr = D.training.find((t) => t.id === id);
      if (!tr) return false;
      const lv = this.data.training[id] || 0;
      if (lv >= tr.max) return false;
      const cost = tr.cost(lv);
      if (this.data.points < cost) return false;
      this.data.points -= cost;
      this.data.training[id] = lv + 1;
      this.save();
      return true;
    },
    resetAll() {
      try { localStorage.removeItem(KEY); } catch (e) {}
      this.data = DEFAULT_SAVE();
      this.save();
      if (G.game) {
        G.game.settings = this.data.settings;
        G.game.applySettings();
      }
    },
    getSettings() { return this.data.settings; },
    saveSettings(s) { this.data.settings = s; this.save(); },
  });
  Save.load();

  // ============================================================
  // UI
  // ============================================================
  const UI = (G.UI = {
    game: null,
    char: 'abigail',
    weapon: 'laser',
    choice: null,
    codexTab: 'enemies',
    modalOpen: false,
    returnFromSheet: null,
    lastPortrait: null,
    lastRelics: 0,
    _interactText: '',
    _toastCount: 0,
    _resetArmed: false,
    _introTimer: null,
    _fadeEl: null,
  });

  UI.init = function (game) {
    this.game = game;
    this.el = {};
    const ids = ['screen-boot', 'screen-menu', 'screen-hud', 'screen-choice', 'screen-pause', 'screen-over', 'screen-codex', 'screen-training', 'screen-settings', 'screen-dossier', 'screen-manual',
      'boot-bar', 'boot-log', 'best-score', 'best-room', 'menu-points', 'char-list', 'weapon-list', 'char-desc', 'btn-start',
      'hud-level', 'hud-char', 'hud-title', 'hp-fill', 'hp-loss', 'hp-text', 'shield-fill', 'shield-text',
      'hud-floor', 'hud-room', 'hud-timer', 'hud-wave', 'hud-gold', 'hud-kills', 'hud-relics', 'floor-progress',
      'boss-bar', 'boss-name', 'boss-fill', 'boss-phase', 'dash-cool', 'skill-cool', 'skill-icon', 'skill2-cool', 'skill2-icon',
      'xp-fill', 'xp-level', 'xp-text', 'hud-weapon', 'hud-weapon-lv', 'hud-build-btn', 'hud-build-count',
      'portrait', 'interact', 'combat-toast', 'btn-pause', 'choice-eyebrow', 'choice-title', 'choice-sub', 'choice-cards', 'choice-reroll', 'reroll-cost', 'choice-hint',
      'pause-build', 'btn-resume', 'btn-pause-settings', 'btn-pause-quit',
      'over-stamp', 'over-grade', 'over-eyebrow', 'over-title', 'over-sub', 'over-stats', 'over-build', 'btn-retry', 'btn-menu', 'btn-over-codex',
      'codex-progress', 'codex-grid', 'codex-close', 'codex-tabs', 'training-points', 'training-list', 'training-close', 'training-reset',
      'set-music', 'set-sfx', 'set-shake', 'set-autoaim', 'set-autofire', 'set-automelee', 'set-reducedfx', 'set-crt', 'set-fullscreen', 'settings-close', 'laser-heat', 'laser-heat-fill', 'laser-heat-label',
      'btn-codex-menu', 'btn-training-menu', 'btn-settings-menu', 'btn-manual-menu', 'btn-dossier', 'btn-pause-dossier', 'btn-pause-manual', 'manual-close', 'touch-skill2',
      'menu-portrait', 'menu-char-name', 'menu-char-skill', 'pause-portrait', 'pause-name', 'pause-skill',
      'cutin', 'cutin-img', 'cutin-char', 'cutin-skill', 'cutin-cn',
      'screen-story', 'story-img', 'story-page', 'story-title', 'story-text', 'story-note', 'story-next', 'story-skip', 'btn-story-menu',
      'boss-dialogue', 'bd-speaker', 'bd-text',
      'dossier-art-img', 'dossier-art-name', 'dossier-art-lock', 'dossier-eyebrow', 'dossier-name', 'dossier-title', 'dossier-lore', 'dossier-quote',
      'dossier-traits', 'dossier-eval', 'dossier-advice', 'dossier-note', 'dossier-stats',
      'dossier-skill-icon', 'dossier-skill-name', 'dossier-skill-desc', 'dossier-skill-tag', 'dossier-skill-cd',
      'dossier-skill2-icon', 'dossier-skill2-name', 'dossier-skill2-desc', 'dossier-skill2-tag', 'dossier-skill2-cd', 'dossier-weapon',
      'dossier-pick', 'dossier-close',
      'btn-sound', 'sound-glyph', 'marquee-track'];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.bind();
    this.buildMarquee();
    this.renderCharacters();
    this.renderWeapons();
    this.refreshMenu();
    this.syncSettings();
    this.showScreen('menu');
  };

  UI.showScreen = function (name) {
    if (name !== 'hud' && this.game) this.game.clearCombatInput();
    const map = {
      boot: 'screen-boot', menu: 'screen-menu', hud: 'screen-hud',
      choice: 'screen-choice', pause: 'screen-pause', over: 'screen-over',
      codex: 'screen-codex', training: 'screen-training', settings: 'screen-settings',
      dossier: 'screen-dossier', manual: 'screen-manual', story: 'screen-story',
    };
    const keep = {
      choice: ['screen-hud'], pause: ['screen-hud'],
      codex: ['screen-menu', 'screen-hud', 'screen-over'],
      training: ['screen-menu', 'screen-hud'],
      settings: ['screen-menu', 'screen-hud', 'screen-pause'],
      dossier: ['screen-menu', 'screen-hud', 'screen-pause', 'screen-codex'],
      manual: ['screen-menu', 'screen-hud', 'screen-pause'],
      story: ['screen-menu'],
    };
    for (const k in map) {
      const el = this.el[map[k]] || document.getElementById(map[k]);
      if (!el) continue;
      let visible = k === name;
      if (!visible && keep[name] && keep[name].indexOf(map[k]) >= 0) visible = !el.hidden;
      if (!visible && k !== 'boot' && name !== 'boot') el.hidden = true;
      if (visible) el.hidden = false;
    }
    // ensure only requested + allowed
    const set = new Set([map[name]]);
    (keep[name] || []).forEach((x) => set.add(x));
    for (const k in map) {
      if (!set.has(map[k]) && map[k] !== 'screen-boot') {
        const el = document.getElementById(map[k]);
        if (el) el.hidden = true;
      }
    }
    if (map[name]) {
      const el = document.getElementById(map[name]);
      if (el) el.hidden = false;
    }
    this.showTouch(name === 'hud');
  };

  UI.showTouch = function (v) {
    const on = !!(v && document.body.classList.contains('touch-mode'));
    document.body.classList.toggle('in-game', on);
    const l = document.getElementById('touch-layer');
    if (!l) return;
    l.hidden = !on;
  };

  UI.hideBoot = function () {
    const b = this.el['screen-boot'];
    if (!b) return;
    b.classList.add('fade-out');
    setTimeout(() => { b.hidden = true; }, 500);
  };

  UI.setBoot = function (pct, text) {
    if (this.el['boot-bar']) this.el['boot-bar'].style.width = pct + '%';
    if (this.el['boot-log'] && text) this.el['boot-log'].textContent = text;
  };

  // ---------------- menu ----------------
  UI.buildMarquee = function () {
    const lines = [
      '公司公告：本月起取消大小周，改为大周。',
      '打印机已连续工作 72 小时，请勿与其对视。',
      '天台的门禁已解除，但没人回来过。',
      'HR 提示：加班费将以积分形式发放，积分不可兑换。',
      '茶水间出现第 4 台咖啡机，它自称是第 1 台。',
      '本层监控已全部离线，请放心加班。',
    ];
    const html = lines.map((l) => `<span>${l}</span>`).join('');
    if (this.el['marquee-track']) this.el['marquee-track'].innerHTML = html + html;
  };

  UI.refreshMenu = function () {
    const d = Save.data;
    if (this.el['best-score']) this.el['best-score'].textContent = U.fmt(d.best.score);
    if (this.el['best-room']) this.el['best-room'].textContent = d.best.room >= 0 ? (d.best.room >= 6 ? 'RF' : ['1F', '1F', '2F', '2F', '3F', '3F'][Math.min(d.best.room, 5)]) : '—';
    if (this.el['menu-points']) this.el['menu-points'].textContent = d.points;
    if (!Save.isUnlocked('ama') && d.best.room >= 2) Save.unlockCharacter('ama');
  };

  UI.renderCharacters = function () {
    const list = this.el['char-list'];
    if (!list) return;
    list.innerHTML = '';
    for (const c of D.characters) {
      const unlocked = Save.isUnlocked(c.id);
      const btn = document.createElement('button');
      btn.className = 'char-card' + (this.char === c.id ? ' is-active' : '') + (unlocked ? '' : ' is-locked');
      btn.style.setProperty('--cc', c.color);
      btn.dataset.char = c.id;
      btn.innerHTML = `
        <div class="char-avatar">
          <img class="${unlocked ? '' : 'locked'}" src="${c.art}" alt="${unlocked ? c.name : '未知员工'}" draggable="false" />
          ${unlocked ? '' : '<span class="lock">✕</span>'}
        </div>
        <div class="char-info">
          <b>${unlocked ? c.name : '？？？'}</b>
          <span>${unlocked ? c.title : '尚未入职'}</span>
          <div class="char-bars">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= c.bars[0] ? 'on' : ''}"></i>`).join('')}</div>
        </div>
        <span class="char-tag ${unlocked ? '' : 'locked'}">${unlocked ? c.tag : 'LOCKED'}</span>
      `;
      btn.addEventListener('click', () => this.selectChar(c.id));
      list.appendChild(btn);
    }
    this.updateMenuEmployee();
  };

  UI.updateMenuEmployee = function () {
    const c = D.characters.find((x) => x.id === this.char);
    const e = this.el;
    if (!c || !e) return;
    if (e['menu-portrait']) {
      e['menu-portrait'].src = c.art;
      e['menu-portrait'].alt = c.name + ' 立绘';
    }
    if (e['menu-char-name']) e['menu-char-name'].textContent = c.name;
    if (e['menu-char-skill']) e['menu-char-skill'].textContent = 'Q ' + c.skill.name + ' · R ' + c.skill2.name;
  };

  UI.selectChar = function (id) {
    const c = D.characters.find((x) => x.id === id);
    if (!c) return;
    if (!Save.isUnlocked(id)) {
      G.Audio.play('deny');
      this.toast('阿码尚未入职：到达 2F 房间后解锁', 'pink');
      return;
    }
    this.char = id;
    this.weapon = c.defaultWeapon;
    this.renderCharacters();
    this.renderWeapons();
    if (this.el['char-desc']) this.el['char-desc'].innerHTML = c.desc;
    G.Audio.play('ui');
  };

  UI.renderWeapons = function () {
    const list = this.el['weapon-list'];
    if (!list) return;
    list.innerHTML = '';
    for (const id of ['keyboard', 'stapler', 'laser', 'keyboard_melee']) {
      const w = D.weapons[id];
      const b = document.createElement('button');
      b.className = 'weapon-btn' + (this.weapon === id ? ' is-active' : '');
      b.dataset.weapon = id;
      b.innerHTML = `<canvas width="64" height="64"></canvas><b>${w.name}</b><span>${w.tags.join(' · ')}</span>`;
      b.addEventListener('click', () => {
        this.weapon = id;
        this.renderWeapons();
        G.Audio.play('ui');
        this.updateCharDesc();
      });
      list.appendChild(b);
      const cv = b.querySelector('canvas');
      if (cv) {
        const ctx = cv.getContext('2d');
        SP.drawWeaponIcon(ctx, w.icon, 32, 32, 58);
      }
    }
    this.updateCharDesc();
  };

  UI.updateCharDesc = function () {
    const c = D.characters.find((x) => x.id === this.char);
    const w = D.weapons[this.weapon];
    if (!this.el['char-desc'] || !c || !w) return;
    this.el['char-desc'].innerHTML = c.desc
      + '<br><br><b>Q · ' + c.skill.name + '</b>（' + c.skill.tag + '）：' + c.skill.short
      + '<br><b>R · ' + c.skill2.name + '</b>（' + c.skill2.tag + '）：' + c.skill2.short
      + '<br><br><b>' + w.name + '</b>：' + w.desc;
  };

  // ---------------- dossier / manual ----------------
  UI.openDossier = function (charId, from) {
    this.dossierChar = charId || this.char;
    let source = from;
    if (!source) {
      if (this.game && this.game.state === 'paused') source = 'pause';
      else if (this.el['screen-codex'] && !this.el['screen-codex'].hidden) source = 'codex';
      else source = 'menu';
    }
    this.dossierReturn = source;
    this.modalOpen = true;
    this.renderDossier(this.dossierChar);
    this.showScreen('dossier');
    G.Audio.play('ui2');
  };

  UI.renderDossier = function (charId) {
    const c = D.characters.find((x) => x.id === charId);
    const e = this.el;
    if (!c || !e['dossier-name']) return;
    const unlocked = Save.isUnlocked(c.id);
    const w = D.weapons[c.defaultWeapon];
    e['dossier-art-img'].src = c.art;
    e['dossier-art-img'].style.filter = unlocked ? '' : 'grayscale(1) brightness(0.5)';
    e['dossier-art-name'].textContent = c.en;
    e['dossier-art-lock'].hidden = unlocked;
    e['dossier-eyebrow'].textContent = 'INFINITY CORP / 员工档案 · ' + c.en;
    e['dossier-name'].textContent = unlocked ? c.name : '？？？';
    e['dossier-title'].textContent = unlocked ? (c.title + ' · ' + c.difficulty) : '未入职 / LOCKED';
    e['dossier-lore'].textContent = unlocked ? c.lore : '档案被 HR 加了密。' + (c.unlockText || '');
    e['dossier-quote'].textContent = unlocked ? c.quote : '「……」';
    const stats = [
      ['生命', Math.round(c.hp), U.clamp(c.hp / 130 * 100, 5, 100)],
      ['移速', Math.round(c.speed), U.clamp((c.speed - 200) / 120 * 100, 5, 100)],
      ['暴击', Math.round(c.crit * 100) + '%', U.clamp(c.crit * 400, 5, 100)],
      ['操作难度', c.id === 'abigail' ? '偏高' : '中等', c.id === 'abigail' ? 72 : 48],
    ];
    e['dossier-stats'].innerHTML = stats.map(([k, v, p]) =>
      `<div class="d-stat"><span>${k}</span><b>${v}</b><i style="--v:${p}%"></i></div>`).join('');
    e['dossier-traits'].innerHTML = unlocked
      ? (c.traits || []).map((tr) => `<span>${tr}</span>`).join('')
      : '<span>???</span><span>???</span><span>???</span>';
    const ev = c.evaluation || {};
    const evals = [['生存', ev.survival || 0], ['火力', ev.firepower || 0], ['机动', ev.mobility || 0], ['控制', ev.control || 0]];
    e['dossier-eval'].innerHTML = `<div class="eval-head"><span>作战评估 / PERFORMANCE</span><em>${unlocked ? 'REVIEWED' : 'NO DATA'}</em></div>`
      + evals.map(([k, v]) => `<div class="eval-row"><span>${k}</span><div class="eval-pips">${[1, 2, 3, 4, 5].map((i) => `<i class="${unlocked && i <= v ? 'on' : ''}"></i>`).join('')}</div></div>`).join('');
    e['dossier-advice'].textContent = unlocked ? ('建议：' + c.advice) : '建议：先活下去。';
    e['dossier-note'].innerHTML = unlocked
      ? '<b>档案备注</b> · ' + (c.note || '无。')
      : '<b>档案备注</b> · 该员工的档案被列为「待观察」。';
    const skill = c.skill;
    e['dossier-skill-name'].textContent = skill.name + ' · ' + skill.en;
    e['dossier-skill-desc'].textContent = unlocked ? skill.desc : '入职后解锁专属技能。';
    e['dossier-skill-tag'].textContent = skill.tag;
    e['dossier-skill-cd'].textContent = 'COOLDOWN ' + skill.cd + 'S';
    const cv = e['dossier-skill-icon'];
    if (cv) {
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      SP.drawIcon(ctx, skill.icon, 8, 8, 48, unlocked ? c.color : '#5e718d', '#ffffff');
    }
    const skill2 = c.skill2;
    e['dossier-skill2-name'].textContent = skill2.name + ' · ' + skill2.en;
    e['dossier-skill2-desc'].textContent = unlocked ? skill2.desc : '入职后解锁副技能。';
    e['dossier-skill2-tag'].textContent = skill2.tag;
    e['dossier-skill2-cd'].textContent = 'COOLDOWN ' + skill2.cd + 'S';
    const cv2 = e['dossier-skill2-icon'];
    if (cv2) {
      const ctx2 = cv2.getContext('2d');
      ctx2.clearRect(0, 0, cv2.width, cv2.height);
      SP.drawIcon(ctx2, skill2.icon, 8, 8, 48, unlocked ? c.color : '#5e718d', '#ffffff');
    }
    e['dossier-weapon'].innerHTML = unlocked
      ? `初始武器 · <b>${w.name}</b> · ${w.tags.join(' / ')}`
      : '初始武器 · ???';
    const canPick = unlocked && this.dossierReturn !== 'pause';
    e['dossier-pick'].disabled = !canPick;
    e['dossier-pick'].textContent = !unlocked
      ? ('未解锁 · ' + (c.unlockText || ''))
      : this.dossierReturn === 'pause' ? '当前员工' : '选择这名员工';
  };

  UI.pickDossier = function () {
    const c = D.characters.find((x) => x.id === this.dossierChar);
    if (!c || !Save.isUnlocked(c.id)) { G.Audio.play('deny'); return; }
    this.char = c.id;
    this.weapon = c.defaultWeapon;
    this.renderCharacters();
    this.renderWeapons();
    this.refreshMenu();
    this.closeDossier();
    this.toast('已选择员工：' + c.name, 'gold');
    G.Audio.play('ui2');
  };

  UI.closeDossier = function () {
    this.modalOpen = false;
    const el = this.el['screen-dossier'];
    if (el) el.hidden = true;
    if (this.dossierReturn === 'pause' && this.game && this.game.state === 'paused') this.showPause();
    else if (this.dossierReturn === 'codex') this.showScreen('codex');
    else this.showMenu();
  };

  UI.openManual = function (from) {
    this.manualReturn = from || (this.game && this.game.state === 'paused' ? 'pause' : 'menu');
    this.modalOpen = true;
    this.showScreen('manual');
    G.Audio.play('ui');
  };

  UI.closeManual = function () {
    this.modalOpen = false;
    const el = this.el['screen-manual'];
    if (el) el.hidden = true;
    if (this.manualReturn === 'pause' && this.game && this.game.state === 'paused') this.showPause();
    else this.showMenu();
  };

  UI.startFromMenu = function () {
    if (!this.game) return;
    if (!Save.isUnlocked(this.char)) { this.toast('这个角色还没入职', 'pink'); return; }
    if (!Save.data.seenStory) {
      this.openStory('start');
      return;
    }
    this.beginRun();
  };

  UI.beginRun = function (mode) {
    G.Audio.init();
    if (this.el['cutin']) { this.el['cutin'].hidden = true; this.el['cutin'].classList.remove('show'); }
    this.lastPortrait = null;
    this.lastFloor = -1;
    this.lastSkillIcon = null;
    this.lastSkill2Icon = null;
    this.lastTouchSkill = null;
    this.lastTouchSkill2 = null;
    G.UI.showScreen('hud');
    this.game.startRun(this.char, this.weapon, false, mode);
    if (!this.game.settings.autoFire) {
      setTimeout(() => this.toast('按住左键开火 / 聚焦 · 设置里可开启自动开火', 'gold'), 800);
    }
    G.Audio.play('ui2');
  };

  UI.openStory = function (from) {
    this.storyFrom = from || 'menu';
    this.storyIndex = 0;
    this.storyPages = D.story || [];
    this.modalOpen = true;
    this.renderStory();
    this.showScreen('story');
    G.Audio.play('ui2');
  };

  UI.renderStory = function () {
    const pages = this.storyPages || D.story || [];
    const p = pages[this.storyIndex];
    const e = this.el;
    if (!p || !e['story-title']) return;
    if (e['story-img']) {
      const abi = D.characters.find((c) => c.id === 'abigail');
      e['story-img'].src = abi ? abi.art : 'assets/abigail_full.webp';
    }
    e['story-page'].textContent = String(this.storyIndex + 1).padStart(2, '0') + ' / ' + String(pages.length).padStart(2, '0');
    e['story-title'].textContent = p.title;
    e['story-text'].textContent = p.text;
    e['story-note'].textContent = p.note || '';
    e['story-next'].textContent = this.storyIndex >= pages.length - 1
      ? (this.storyFrom === 'start' ? '开始加班' : '返回工位')
      : '继续';
    // retrigger the page fade
    const body = e['story-title'].parentElement;
    if (body) {
      body.classList.remove('story-anim');
      void body.offsetWidth;
      body.classList.add('story-anim');
    }
  };

  UI.nextStory = function () {
    const pages = this.storyPages || D.story || [];
    if (this.storyIndex >= pages.length - 1) {
      this.closeStory();
      return;
    }
    this.storyIndex++;
    this.renderStory();
    G.Audio.play('ui');
  };

  UI.closeStory = function () {
    const fromStart = this.storyFrom === 'start';
    this.modalOpen = false;
    if (this.el['screen-story']) this.el['screen-story'].hidden = true;
    if (this.el['boss-dialogue']) this.el['boss-dialogue'].hidden = true;
    Save.data.seenStory = true;
    Save.save();
    if (fromStart) this.beginRun();
    else this.showMenu();
  };

  UI.showMenu = function () {
    this.showScreen('menu');
    this.refreshMenu();
    if (this.game) {
      this.game.state = 'menu';
      G.Audio.setMood('menu');
      G.Audio.stopLaser();
    }
    this.modalOpen = false;
  };

  // ---------------- hud ----------------
  UI.showHud = function () {
    this.showScreen('hud');
  };
  UI.hideHud = function () {
    if (this.el['screen-hud']) this.el['screen-hud'].hidden = true;
  };

  UI.updateHud = function (game, force) {
    const run = game.run;
    if (!run || !run.stats) return;
    const e = this.el;
    if (!e) return;
    const hpPct = U.clamp(run.hp / run.maxHp, 0, 1);
    if (e['hp-fill']) {
      e['hp-fill'].style.width = (hpPct * 100).toFixed(2) + '%';
      e['hp-fill'].classList.toggle('low', hpPct < 0.3);
    }
    if (e['hp-loss']) e['hp-loss'].style.width = (hpPct * 100).toFixed(2) + '%';
    if (e['hp-text']) e['hp-text'].textContent = Math.ceil(Math.max(0, run.hp)) + ' / ' + Math.round(run.maxHp);
    if (e['shield-fill']) e['shield-fill'].style.width = Math.min(100, run.shield / 1.2) + '%';
    if (e['shield-text']) e['shield-text'].textContent = '护盾 ' + Math.round(run.shield);
    if (e['hud-level']) e['hud-level'].textContent = 'LV.' + run.level;
    if (e['hud-char']) e['hud-char'].textContent = D.characters.find((c) => c.id === run.character).name;
    if (e['hud-title']) e['hud-title'].textContent = D.characters.find((c) => c.id === run.character).title;
    const room = run.roomIndex >= 6 ? D.BOSS_ROOM : D.rooms[Math.min(run.roomIndex, D.rooms.length - 1)];
    const isBoss = run.roomIndex >= 6;
    if (e['hud-floor']) e['hud-floor'].textContent = isBoss ? 'RF' : room.code.slice(0, 2);
    if (e['hud-room']) e['hud-room'].textContent = (isBoss ? '天台 · 最终层' : room.label + ' · ' + String(run.roomIndex + 1).padStart(2, '0') + '/0' + D.rooms.length);
    if (e['hud-timer']) e['hud-timer'].textContent = U.formatTime(run.time);
    if (e['floor-progress'] && (this.lastFloor !== run.roomIndex || force)) {
      this.lastFloor = run.roomIndex;
      let html = '';
      for (let i = 0; i < 7; i++) {
        const cls = 'floor-node' + (i < run.roomIndex ? ' done' : '') + (i === run.roomIndex ? ' now' : '') + (i === 6 ? ' boss' : '');
        html += '<i class="' + cls + '"></i>';
      }
      e['floor-progress'].innerHTML = html;
    }
    if (e['hud-gold']) e['hud-gold'].textContent = Math.floor(run.gold);
    if (e['hud-kills']) e['hud-kills'].textContent = run.kills;
    if (e['xp-level']) e['xp-level'].textContent = run.level;
    if (e['xp-fill']) e['xp-fill'].style.width = U.clamp(run.xp / run.xpNext, 0, 1) * 100 + '%';
    if (e['xp-text']) e['xp-text'].textContent = Math.floor(run.xp) + ' / ' + Math.round(run.xpNext);
    // weapon
    const w = D.weapons[run.weapon];
    if (e['hud-weapon']) e['hud-weapon'].textContent = w.name;
    if (e['hud-weapon-lv']) e['hud-weapon-lv'].textContent = 'Lv.' + run.weaponLevel + ' · ' + w.tags[0];
    if (e['hud-build-count']) e['hud-build-count'].textContent = run.upgrades.length + run.relics.length;
    // cooldowns
    const p = game.player;
    if (p) {
      if (e['laser-heat']) {
        e['laser-heat'].hidden = !w.beam;
        const heat = Math.round((p.laserHeat || 0) * 100);
        e['laser-heat'].setAttribute('aria-valuenow', heat);
        e['laser-heat'].classList.toggle('hot', heat >= 75);
        e['laser-heat'].classList.toggle('locked', !!p.laserOverheated);
        e['laser-heat-fill'].style.width = heat + '%';
        e['laser-heat-label'].textContent = (p.laserOverheated ? '过热 · 冷却中 ' : p.beam ? '发射 ' : heat ? '散热 ' : '就绪 ') + heat + '%';
      }
      const dashMax = Math.max(1, run.stats.dashCharges);
      const partial = p.dashCharge < dashMax ? 1 - U.clamp(p.dashRecharge / Math.max(0.2, run.stats.dodgeCd), 0, 1) : 0;
      const dashK = U.clamp((p.dashCharge + partial) / dashMax, 0, 1);
      if (e['dash-cool']) {
        e['dash-cool'].style.setProperty('--p', dashK.toFixed(3));
        e['dash-cool'].classList.toggle('ready', p.dashCharge > 0);
        const nameEl = e['dash-cool'].querySelector('.cool-name');
        if (nameEl) nameEl.textContent = dashMax > 1 ? '闪避 ×' + Math.ceil(p.dashCharge) : '闪避';
      }
      const skillMax = run.stats.skillCd;
      const skillK = U.clamp(1 - p.skillCd / skillMax, 0, 1);
      if (e['skill-cool']) {
        e['skill-cool'].style.setProperty('--p', skillK.toFixed(3));
        e['skill-cool'].classList.toggle('ready', p.skillCd <= 0.02);
        const char = D.characters.find((c) => c.id === run.character);
        if (char && char.skill) {
          const nameEl = e['skill-cool'].querySelector('.cool-name');
          if (nameEl) nameEl.textContent = char.skill.name;
          e['skill-cool'].title = char.skill.desc + '（冷却 ' + Math.round(run.stats.skillCd) + ' 秒）';
          if (this.lastSkillIcon !== char.skill.id) {
            this.lastSkillIcon = char.skill.id;
            const cv = document.getElementById('skill-icon');
            if (cv) SP.drawIcon(cv.getContext('2d'), char.skill.icon, 2, 2, 44, char.color, '#ffffff');
          }
          if (this.lastTouchSkill !== char.skill.id) {
            this.lastTouchSkill = char.skill.id;
            const tb = document.getElementById('touch-skill');
            if (tb) tb.textContent = char.skill.name;
          }
        }
      }
      const skill2Max = run.stats.skill2Cd;
      const skill2K = U.clamp(1 - p.skill2Cd / skill2Max, 0, 1);
      if (e['skill2-cool']) {
        e['skill2-cool'].style.setProperty('--p', skill2K.toFixed(3));
        e['skill2-cool'].classList.toggle('ready', p.skill2Cd <= 0.02);
        const char = D.characters.find((c) => c.id === run.character);
        if (char && char.skill2) {
          const nameEl = e['skill2-cool'].querySelector('.cool-name');
          if (nameEl) nameEl.textContent = char.skill2.name;
          e['skill2-cool'].title = char.skill2.desc + '（冷却 ' + Math.round(run.stats.skill2Cd) + ' 秒）';
          if (this.lastSkill2Icon !== char.skill2.id) {
            this.lastSkill2Icon = char.skill2.id;
            const cv = document.getElementById('skill2-icon');
            if (cv) SP.drawIcon(cv.getContext('2d'), char.skill2.icon, 2, 2, 44, char.color, '#ffffff');
          }
          if (this.lastTouchSkill2 !== char.skill2.id) {
            this.lastTouchSkill2 = char.skill2.id;
            const tb = document.getElementById('touch-skill2');
            if (tb) tb.textContent = char.skill2.name;
          }
        }
      }
    }
    // portrait once
    if (this.lastPortrait !== run.character) {
      this.lastPortrait = run.character;
      const cv = e['portrait'];
      if (cv) SP.drawPortrait(cv.getContext('2d'), run.character, cv.width, cv.height);
    }
    // relics
    if (this.lastRelics !== run.relics.length || force) {
      this.refreshRelics(game);
    }
    // boss
    if (game.boss && !game.boss.dead) {
      const b = game.boss;
      if (e['boss-fill']) e['boss-fill'].style.width = U.clamp(b.hp / b.hpMax, 0, 1) * 100 + '%';
      if (e['boss-phase']) e['boss-phase'].textContent = '阶段 ' + b.phase;
      if (e['boss-bar']) e['boss-bar'].hidden = false;
    } else if (e['boss-bar']) {
      e['boss-bar'].hidden = true;
    }
  };

  UI.refreshRelics = function (game) {
    const run = game ? game.run : this.game && this.game.run;
    if (!run) return;
    this.lastRelics = run.relics.length;
    const row = this.el['hud-relics'];
    if (!row) return;
    row.innerHTML = '';
    for (const r of run.relics) {
      const d = document.createElement('div');
      d.className = 'relic-chip';
      d.dataset.name = r.name + ' · ' + r.desc;
      const cv = document.createElement('canvas');
      cv.width = 48; cv.height = 48;
      SP.drawIcon(cv.getContext('2d'), r.icon, 6, 6, 36, rarityColor(r.rarity), '#ffffff');
      d.appendChild(cv);
      row.appendChild(d);
    }
  };

  UI.hudWave = function (a, b) {
    const el = this.el['hud-wave'];
    if (!el) return;
    if (!a || !b) {
      el.textContent = '清空 · 选择门';
      el.classList.remove('danger');
    } else {
      el.textContent = 'WAVE ' + a + ' / ' + b;
      el.classList.toggle('danger', a === b);
    }
  };

  UI.hudBossPhase = function (p) {
    if (this.el['boss-phase']) this.el['boss-phase'].textContent = '阶段 ' + p;
  };

  UI.hudBoss = function () {
    const el = this.el['hud-wave'];
    if (!el) return;
    el.textContent = 'FINAL BOSS';
    el.classList.add('danger');
  };

  UI.showBoss = function (boss) {
    document.body.classList.add('boss-mode');
    if (this.el['boss-bar']) this.el['boss-bar'].hidden = false;
    if (this.el['boss-name']) this.el['boss-name'].textContent = '周报魔王 · KPI-0';
    if (this.el['boss-phase']) this.el['boss-phase'].textContent = '阶段 1';
  };
  UI.hideBoss = function () {
    document.body.classList.remove('boss-mode');
    if (this.el['boss-bar']) this.el['boss-bar'].hidden = true;
  };

  UI.setInteract = function (text) {
    if (text === this._interactText) return;
    this._interactText = text;
    const el = this.el['interact'];
    if (!el) return;
    if (!text) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<kbd>E</kbd><span>' + text.replace(/^按 E\s*/, '') + '</span>';
  };

  UI.combatToast = function (text) {
    const el = this.el['combat-toast'];
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  };

  UI.fadeHudLevel = function () {
    const el = this.el['hud-level'];
    if (!el) return;
    el.style.transform = 'scale(1.5)';
    el.style.color = '#fff';
    setTimeout(() => { el.style.transform = ''; el.style.color = ''; }, 220);
  };

  // ---------------- toast ----------------
  UI.toast = function (msg, type) {
    const zone = document.getElementById('toast-zone');
    if (!zone) return;
    while (zone.children.length > 4) zone.removeChild(zone.firstChild);
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    zone.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, 2700);
  };

  // ---------------- room intro / fade ----------------
  UI.showRoomIntro = function (index) {
    const room = index >= 6 ? D.BOSS_ROOM : D.rooms[Math.min(index, D.rooms.length - 1)];
    const floor = index >= 6 ? 'ROOFTOP' : room.code;
    const el = document.createElement('div');
    el.className = 'room-intro';
    const quote = index >= 6 ? 'KPI-0：加班费？那是给有绩效的人的。' : U.pick(D.roomQuotes || []);
    el.innerHTML = `<div class="ri-code">${floor}</div><div class="ri-line"></div><div class="ri-name">${room.label}</div><div class="ri-sub">${index >= 6 ? 'FINAL FLOOR · NO WAY BACK' : 'SECTOR ' + String(index + 1).padStart(2, '0') + ' / 06'}</div><div class="ri-quote">${quote}</div>`;
    const ui = document.getElementById('ui');
    if (!ui) return;
    ui.appendChild(el);
    setTimeout(() => el.classList.add('out'), 1600);
    setTimeout(() => el.remove(), 2400);
  };

  UI.ensureFade = function () {
    if (this._fadeEl && document.body.contains(this._fadeEl)) return this._fadeEl;
    const el = document.createElement('div');
    el.className = 'fade-layer';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    const ui = document.getElementById('ui');
    if (ui) ui.appendChild(el);
    this._fadeEl = el;
    return el;
  };
  UI.fadeOut = function (dur, cb) {
    const el = this.ensureFade();
    el.style.transition = 'opacity ' + dur + 's ease';
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
    setTimeout(() => { if (cb) cb(); }, dur * 1000 + 20);
  };
  UI.fadeIn = function (dur) {
    const el = this.ensureFade();
    el.style.transition = 'opacity ' + dur + 's ease';
    el.style.opacity = '0';
    setTimeout(() => { el.style.pointerEvents = 'none'; }, dur * 1000 + 20);
  };

  // ---------------- choice ----------------
  const RARITY_LABEL = { common: '普通', rare: '稀有', epic: '史诗', legend: '传说', curse: '诅咒' };
  function rarityColor(r) { return (D.rarity[r] && D.rarity[r].color) || '#a9b8cf'; }

  UI.showChoice = function (opts) {
    this.choice = opts;
    this.modalOpen = false;
    G.Audio.play('ui2');
    const e = this.el;
    if (!e['screen-choice']) return;
    if (e['choice-sub']) e['choice-sub'].style.maxWidth = '';
    e['choice-eyebrow'].textContent = opts.eyebrow || '';
    e['choice-title'].textContent = opts.title || '';
    e['choice-sub'].textContent = opts.sub || '';
    this.renderChoiceCards(opts.items || []);
    // reroll / leave
    const rr = e['choice-reroll'];
    if (!rr) return;
    if (opts.type === 'shop') {
      rr.hidden = false;
      rr.innerHTML = '<span>离开贩卖机</span>';
      rr.onclick = () => {
        G.Audio.play('ui');
        if (this.game) { this.game.choiceOpen = false; this.game.state = 'play'; }
        this.closeChoice();
      };
    } else if (opts.reroll) {
      rr.hidden = false;
      const cost = 20 + this.game.run.rerolls * 8;
      rr.innerHTML = '<span>重掷</span><em id="reroll-cost">¥' + cost + '</em>';
      rr.onclick = () => { if (this.game) this.game.rerollUpgrades(); };
    } else {
      rr.hidden = true;
    }
    if (e['choice-hint']) {
      e['choice-hint'].textContent = opts.type === 'shop' ? '点击商品购买 · 金币不足的商品会变灰' : opts.type === 'event' ? '点击选项 · 一旦选择无法撤回' : '按 1 / 2 / 3 选择 · TAB 查看构筑';
    }
    this.showScreen('choice');
  };

  UI.renderChoiceCards = function (items) {
    const wrap = this.el['choice-cards'];
    if (!wrap) return;
    wrap.innerHTML = '';
    const opts = this.choice;
    items.forEach((it, idx) => {
      const card = document.createElement('button');
      let rarity = it.rarity || 'common';
      if (opts.type === 'event') rarity = 'rare';
      if (it.kind === 'heal') rarity = 'common';
      card.className = 'choice-card rarity-' + rarity + (it.skill ? ' is-skill' : '');
      card.dataset.idx = idx;
      let iconName = it.icon || 'star';
      if (opts.type === 'event') {
        const map = { vending: 'gold', hr: 'paper', phone: 'clock', cleaner: 'coffee' };
        iconName = map[it.id] || 'paper';
      }
      let html = '';
      const rarityLabel = opts.type === 'event' ? 'EVENT' : opts.type === 'shop' ? '商品' : it.skill ? 'SKILL · ' + RARITY_LABEL[rarity] : RARITY_LABEL[rarity];
      html += `<div class="card-top"><span class="card-rarity">${rarityLabel}</span><span class="card-key">${idx + 1}</span></div>`;
      html += `<div class="card-icon"><canvas width="72" height="72"></canvas></div>`;
      if (opts.type === 'event') {
        html += `<h3>${it.label}</h3>`;
        html += `<div class="card-line">CHOOSE</div>`;
        html += `<p>${it.desc || ''}</p>`;
        if (it.price) html += `<div class="card-price"><span>价格</span><span>¥${it.price}</span></div>`;
        html += `<div class="card-flavor">— 无法撤回 —</div>`;
      } else if (opts.type === 'shop') {
        html += `<h3>${it.name}</h3>`;
        html += `<div class="card-line">${(it.rarity || 'common').toUpperCase()}</div>`;
        html += `<p>${it.desc}</p>`;
        if (it.flavor) html += `<div class="card-flavor">${it.flavor}</div>`;
        html += `<div class="card-price"><span>售价</span><span>¥${it.price}</span></div>`;
      } else {
        html += `<h3>${it.name}</h3>`;
        html += `<div class="card-line">${(it.en || '').toUpperCase()}</div>`;
        html += `<p>${it.desc}</p>`;
        if (it.tags && it.tags.length) html += `<div class="card-tag-row">${it.tags.map((t) => `<span class="card-tag">${t}</span>`).join('')}</div>`;
        html += `<div class="card-flavor">${it.flavor || ''}</div>`;
      }
      card.innerHTML = html;
      const cv = card.querySelector('canvas');
      if (cv) {
        const ctx = cv.getContext('2d');
        if (opts.type === 'event') {
          SP.drawIcon(ctx, iconName, 12, 12, 48, '#b388ff', '#ffffff');
        } else if (it.kind === 'heal') {
          SP.drawIcon(ctx, 'heal', 12, 12, 48, '#a6ff5e', '#ffffff');
        } else {
          SP.drawIcon(ctx, iconName, 12, 12, 48, rarityColor(rarity), '#ffffff');
        }
      }
      if (opts.type === 'shop') {
        const can = this.game.run.gold >= it.price;
        if (!can) card.classList.add('is-disabled');
      }
      if (opts.type === 'event' && it.can && !it.can(this.game.run)) {
        card.classList.add('is-disabled');
      }
      card.addEventListener('click', () => this.pickChoice(idx));
      wrap.appendChild(card);
    });
  };

  UI.replaceChoiceItems = function (items, nextCost) {
    if (!this.choice) return;
    this.choice.items = items;
    this.renderChoiceCards(items);
    const rr = this.el['choice-reroll'];
    if (rr && this.choice.type !== 'shop') {
      rr.innerHTML = '<span>重掷</span><em id="reroll-cost">¥' + nextCost + '</em>';
    }
  };

  UI.pickChoice = function (idx) {
    if (!this.choice) return;
    const it = this.choice.items[idx];
    if (!it) return;
    const g = this.game;
    if (this.choice.type === 'upgrade') {
      g.pickUpgrade(it);
    } else if (this.choice.type === 'boss-upgrade') {
      G.Modes.pickBossUpgrade(g, it);
    } else if (this.choice.type === 'relic') {
      g.pickRelic(it);
    } else if (this.choice.type === 'event') {
      if (it.can && !it.can(g.run)) { G.Audio.play('deny'); this.toast('金币不足', 'pink'); return; }
      g.choiceOpen = false;
      g.state = 'play';
      this.closeChoice();
      // An event may open another choice; close the old panel before applying it.
      try { it.apply(g.run, g); } catch (err) { console.error(err); }
      G.Audio.play('ui2');
    } else if (this.choice.type === 'shop') {
      g.buyShopItem(it);
    }
  };

  UI.closeChoice = function () {
    const el = this.el['screen-choice'];
    if (el) el.hidden = true;
    this.choice = null;
    if (this.game && (this.game.state === 'play' || this.game.state === 'cleared')) this.showTouch(true);
  };
  UI.hideChoice = function () { this.closeChoice(); };

  UI.showEvent = function (ev, game) {
    this.game = game;
    this.showChoice({
      type: 'event',
      eyebrow: ev.eyebrow,
      title: ev.title,
      sub: ev.text,
      items: ev.options.map((o) => ({ ...o, id: ev.id })),
      reroll: false,
    });
    this._interactText = '';
    if (this.el['choice-sub']) this.el['choice-sub'].style.maxWidth = '64cqw';
  };

  // ---------------- pause ----------------
  UI.showPause = function () {
    this.showScreen('pause');
    this.updatePauseBuild();
    const e = this.el;
    if (this.game && this.game.run) {
      const c = D.characters.find((x) => x.id === this.game.run.character);
      if (c) {
        if (e['pause-portrait']) { e['pause-portrait'].src = c.art; e['pause-portrait'].alt = c.name + ' 立绘'; }
        if (e['pause-name']) e['pause-name'].textContent = c.name + ' · ' + c.title;
        if (e['pause-skill']) e['pause-skill'].textContent = 'Q ' + c.skill.name + ' · R ' + c.skill2.name;
      }
    }
    this.modalOpen = false;
  };

  UI.bossLine = function (speaker, text, dur) {
    const e = this.el;
    if (!e || !e['boss-dialogue']) return;
    e['bd-speaker'].textContent = speaker;
    e['bd-text'].textContent = text;
    e['boss-dialogue'].hidden = false;
    clearTimeout(this._bossLineTimer);
    this._bossLineTimer = setTimeout(() => {
      if (e['boss-dialogue']) e['boss-dialogue'].hidden = true;
    }, (dur || 2.6) * 1000);
  };

  UI.cutIn = function (charId, skill) {
    const c = D.characters.find((x) => x.id === charId);
    const e = this.el;
    if (!c || !skill || !e || !e['cutin']) return;
    e['cutin-img'].src = c.art;
    e['cutin-char'].textContent = c.en;
    e['cutin-skill'].textContent = skill.en;
    e['cutin-cn'].textContent = skill.name;
    const el = e['cutin'];
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this._cutinTimer);
    this._cutinTimer = setTimeout(() => { el.hidden = true; el.classList.remove('show'); }, 900);
  };
  UI.hidePause = function () {
    const el = this.el['screen-pause'];
    if (el) el.hidden = true;
    this.modalOpen = false;
    if (this.game && (this.game.state === 'play' || this.game.state === 'cleared')) this.showTouch(true);
  };

  UI.updatePauseBuild = function () {
    const wrap = this.el['pause-build'];
    if (!wrap || !this.game || !this.game.run) return;
    const run = this.game.run;
    const w = D.weapons[run.weapon];
    const char = D.characters.find((c) => c.id === run.character);
    let html = '';
    if (char && char.skill) {
      html += `<div class="build-group"><div class="build-label">SKILLS</div><div class="build-row"><span class="build-pill" style="color:${char.color};border-color:${char.color}55">Q · ${char.skill.name}</span><span class="build-pill" style="color:${char.color};border-color:${char.color}55">R · ${char.skill2.name}</span></div><div class="build-skill-desc">${char.skill.desc}<br>${char.skill2.desc}</div></div>`;
    }
    html += `<div class="build-group"><div class="build-label">WEAPON</div><div class="build-row"><span class="build-pill">${w.name} Lv.${run.weaponLevel}</span></div></div>`;
    if (run.upgrades.length) {
      html += `<div class="build-group"><div class="build-label">UPGRADES / ${run.upgrades.length}</div><div class="build-row">`;
      const counts = {};
      for (const u of run.upgrades) counts[u.name] = (counts[u.name] || 0) + 1;
      for (const k in counts) html += `<span class="build-pill">${k}${counts[k] > 1 ? ' ×' + counts[k] : ''}</span>`;
      html += `</div></div>`;
    }
    if (run.relics.length) {
      html += `<div class="build-group"><div class="build-label">RELICS / ${run.relics.length}</div><div class="build-row">`;
      for (const r of run.relics) html += `<span class="build-pill relic">${r.name}</span>`;
      html += `</div></div>`;
    }
    if (!run.upgrades.length && !run.relics.length) html += `<div class="build-group"><div class="build-label">还没有任何构筑</div></div>`;
    wrap.innerHTML = html;
  };

  // ---------------- game over ----------------
  UI.showGameOver = function (game, win) {
    const run = game.run;
    this.game = game;
    document.body.classList.remove('boss-mode');
    this.hideHud();
    this.closeChoice();
    this.hidePause();
    if (this.el['boss-dialogue']) this.el['boss-dialogue'].hidden = true;
    const score = run.score;
    let grade = 'D';
    if (win) grade = score >= 5200 ? 'S' : 'A';
    else if (score >= 3800) grade = 'A';
    else if (score >= 2400) grade = 'B';
    else if (score >= 1200) grade = 'C';
    const colors = { S: '#ffd24a', A: '#57f4ff', B: '#b388ff', C: '#a6ff5e', D: '#a9b8cf' };
    if (this.el['over-grade']) {
      this.el['over-grade'].textContent = grade;
      this.el['over-grade'].style.setProperty('--grade-color', colors[grade]);
    }
    if (this.el['over-stamp']) {
      this.el['over-stamp'].textContent = win ? '晋升' : '辞退';
      this.el['over-stamp'].classList.toggle('win', win);
    }
    if (this.el['over-eyebrow']) this.el['over-eyebrow'].textContent = win ? 'SHIFT COMPLETE / CONGRATULATIONS' : 'SHIFT TERMINATED';
    if (this.el['over-title']) this.el['over-title'].textContent = win ? '你活着走出了大楼' : '本日加班结束';
    const subs = win
      ? ['加班费到账：¥0.00（税前）。至少你活着走出了大楼。', '周报魔王签收了你的离职申请。电梯下行时，整栋楼都安静了。', '你把工牌留在了顶楼。明早的太阳有点陌生。', 'KPI-0 被格式化。恭喜，你成为了新的传说。']
      : ['你被打印机吃掉了。人事说这算工伤。', '你的加班费已作为遗产发放给公司。', 'HR：你只是毕业了，不是被开除。', '加班第七十二小时，你终于变成了公司的一部分。', '保洁阿姨把你的工牌收进了抽屉。抽屉里已经有很多张了。', '你倒在了离天台最近的一层。差一点。'];
    if (this.el['over-sub']) this.el['over-sub'].textContent = win ? subs[0] : U.pick(subs);
    if (win && window.confetti) {
      try {
        window.confetti({
          particleCount: 120,
          spread: 78,
          startVelocity: 34,
          gravity: 0.9,
          decay: 0.92,
          scalar: 0.9,
          ticks: 180,
          zIndex: 41,
          disableForReducedMotion: true,
          colors: ['#39f4ff', '#ffd24a', '#ff3d81', '#8cffb0', '#b388ff'],
          shapes: ['square'],
          origin: { x: 0.5, y: 0.62 },
        });
      } catch (e) { /* no confetti, no failure */ }
    }
    const stats = [
      ['存活时长', U.formatTime(run.time), ''],
      ['击杀异常', run.kills, ''],
      ['等级', 'LV.' + run.level, ''],
      ['金币', Math.floor(run.gold), 'gold'],
      ['清理房间', run.roomsCleared + ' / ' + (G.Modes.forRun(run).bosses || 6), ''],
      ['破坏公物', run.destroyed || 0, ''],
      ['最高连击', run.bestCombo, ''],
      ['本次绩效', score, 'gold'],
      ['获得绩效点', '+' + run.pointsEarned, 'gold'],
    ];
    if (this.el['over-stats']) {
      this.el['over-stats'].innerHTML = stats.map(([k, v, cls]) => `<div class="over-stat ${cls}"><span>${k}</span><b>${v}</b></div>`).join('');
    }
    if (this.el['over-build']) {
      let html = '';
      const char = D.characters.find((c) => c.id === run.character);
      if (char) html += `<div class="build-group"><div class="build-label">SKILLS</div><div class="build-row"><span class="build-pill">Q · ${char.skill.name}</span><span class="build-pill">R · ${char.skill2.name}</span></div></div>`;
      if (run.upgrades.length) {
        html += `<div class="build-group"><div class="build-label">UPGRADES</div><div class="build-row">`;
        const counts = {};
        for (const u of run.upgrades) counts[u.name] = (counts[u.name] || 0) + 1;
        for (const k in counts) html += `<span class="build-pill">${k}${counts[k] > 1 ? ' ×' + counts[k] : ''}</span>`;
        html += `</div></div>`;
      }
      if (run.relics.length) {
        html += `<div class="build-group"><div class="build-label">RELICS</div><div class="build-row">`;
        for (const r of run.relics) html += `<span class="build-pill relic">${r.name}</span>`;
        html += `</div></div>`;
      }
      this.el['over-build'].innerHTML = html || '<div class="build-group"><div class="build-label">空手而来，空手而归</div></div>';
    }
    this.showScreen('over');
    this.modalOpen = false;
    if (win) G.Audio.play('victory');
    this.refreshMenu();
  };

  UI.restartFromOver = function () {
    if (!this.game || !this.game.run) return;
    const run = this.game.run;
    const char = run.character, weapon = run.weapon;
    const el = this.el['screen-over'];
    if (el) el.hidden = true;
    this.game.savedRun = false;
    this.game.startRun(char, weapon, true, run.mode);
    this.showScreen('hud');
    G.Audio.play('ui2');
  };

  UI.toMenu = function () {
    const el = this.el['screen-over'];
    if (el) el.hidden = true;
    this.showMenu();
    G.Audio.play('ui');
  };

  // ---------------- codex ----------------
  UI.openCodex = function (from) {
    this.returnFromSheet = from || (this.game && this.game.state === 'paused' ? 'pause' : this.game && (this.game.state === 'gameover' || this.game.state === 'victory') ? 'over' : 'menu');
    this.modalOpen = true;
    this.renderCodex(this.codexTab);
    this.showScreen('codex');
    G.Audio.play('ui2');
  };
  UI.closeCodex = function () {
    this.modalOpen = false;
    const el = this.el['screen-codex'];
    if (el) el.hidden = true;
    if (this.returnFromSheet === 'pause') this.showPause();
    else if (this.returnFromSheet === 'over') { this.showScreen('over'); }
    else this.showMenu();
  };

  UI.renderCodex = function (tab) {
    this.codexTab = tab || 'enemies';
    const wrap = this.el['codex-grid'];
    if (!wrap) return;
    const isCharTab = this.codexTab === 'characters';
    const groups = { enemies: 'enemies', weapons: 'weapons', relics: 'relics', characters: 'characters' };
    const seenArr = isCharTab ? [] : (Save.data.seen[groups[this.codexTab]] || []);
    const all = D.codex[this.codexTab] || [];
    let unlocked = 0;
    for (const item of all) {
      if (isCharTab ? Save.isUnlocked(item.id) : seenArr.indexOf(item.id) >= 0) unlocked++;
    }
    if (this.el['codex-progress']) this.el['codex-progress'].textContent = '已解锁 ' + unlocked + ' / ' + all.length;
    const tabs = this.el['codex-tabs'];
    if (tabs) {
      Array.from(tabs.querySelectorAll('.tab')).forEach((b) => b.classList.toggle('is-active', b.dataset.tab === this.codexTab));
    }
    wrap.innerHTML = '';
    for (const item of all) {
      const isSeen = isCharTab ? Save.isUnlocked(item.id) : (seenArr.indexOf(item.id) >= 0 || !item.id);
      const card = document.createElement('div');
      card.className = 'codex-card' + (isSeen ? '' : ' is-locked') + (isCharTab && isSeen ? ' clickable' : '');
      if (isCharTab) {
        card.innerHTML = `
          <div class="thumb"><img src="${item.art}" alt="${isSeen ? item.name : '未知员工'}" class="${isSeen ? '' : 'locked-thumb'}" /></div>
          <div>
            <h3>${isSeen ? item.name : '？？？'}<span class="rarity-dot" style="--rc:${item.color || '#57f4ff'}"></span></h3>
            <span class="en">${isSeen ? (item.en || '') : 'UNKNOWN'}</span>
            <p>${isSeen ? (item.desc || '') : ('尚未入职。' + (item.unlockText || ''))}</p>
            <p class="codex-skill-line">${isSeen ? ('技能 · ' + item.skill.name + ' / ' + item.skill.tag) : '技能 · ???'}</p>
            ${isSeen && item.tip ? `<p class="codex-tip">${item.tip}</p>` : ''}
          </div>`;
        if (isSeen) card.addEventListener('click', () => this.openDossier(item.id, 'codex'));
        wrap.appendChild(card);
        continue;
      }
      const rc = item.rarity ? rarityColor(item.rarity) : '#57f4ff';
      card.innerHTML = `
        <div class="thumb"></div>
        <div>
          <h3>${isSeen ? item.name : '？？？'}${item.rarity ? `<span class="rarity-dot" style="--rc:${rc}"></span>` : ''}</h3>
          <span class="en">${isSeen ? (item.en || '') : 'UNKNOWN'}</span>
          <p>${isSeen ? (item.desc || '') : '尚未记录。' + (this.codexTab === 'enemies' ? '击败它即可解锁。' : this.codexTab === 'weapons' ? '使用它即可解锁。' : '获得它即可解锁。')}</p>
          ${isSeen && item.tip ? `<p class="codex-tip">${item.tip}</p>` : ''}
        </div>`;
      const thumb = card.querySelector('.thumb');
      const cv = document.createElement('canvas');
      cv.width = 84; cv.height = 84;
      const c = cv.getContext('2d');
      if (isSeen) {
        if (this.codexTab === 'enemies') {
          if (item.boss) {
            c.save(); c.translate(42, 80); c.scale(0.36, 0.36);
            SP.drawBoss(c, 0, 0, { t: 0.4, phase: 1, flash: 0, eyeDir: 0 });
            c.restore();
          } else {
            SP.drawEnemy(c, item.sprite || 'paper', 42, 70, { t: 0.4, flash: 0 });
          }
        } else if (this.codexTab === 'weapons') {
          SP.drawWeaponIcon(c, item.icon, 42, 42, 56);
        } else {
          SP.drawIcon(c, item.icon, 18, 18, 48, rc, '#ffffff');
        }
      } else {
        c.fillStyle = 'rgba(130,170,210,0.5)';
        c.font = 'bold 30px Consolas';
        c.textAlign = 'center';
        c.fillText('?', 42, 56);
      }
      thumb.appendChild(cv);
      wrap.appendChild(card);
    }
  };

  // ---------------- training ----------------
  UI.openTraining = function () {
    this.returnFromSheet = this.game && this.game.state === 'paused' ? 'pause' : 'menu';
    this.modalOpen = true;
    this.renderTraining();
    this.showScreen('training');
    G.Audio.play('ui2');
  };
  UI.closeTraining = function () {
    this.modalOpen = false;
    this._resetArmed = false;
    const el = this.el['screen-training'];
    if (el) el.hidden = true;
    if (this.returnFromSheet === 'pause') this.showPause();
    else this.showMenu();
  };

  UI.renderTraining = function () {
    if (this.el['training-points']) this.el['training-points'].textContent = Save.data.points;
    const wrap = this.el['training-list'];
    if (!wrap) return;
    wrap.innerHTML = '';
    for (const tr of D.training) {
      const lv = Save.data.training[tr.id] || 0;
      const cost = tr.cost(lv);
      const maxed = lv >= tr.max;
      const can = !maxed && Save.data.points >= cost;
      const row = document.createElement('div');
      row.className = 'training-row';
      row.innerHTML = `
        <div class="training-ico"></div>
        <div class="training-info">
          <b>${tr.name} <span style="color:#5e718d;font-family:var(--mono);font-size:.62cqw;letter-spacing:.12em">${tr.en}</span></b>
          <span>${tr.desc}</span>
          <div class="training-pips">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>
        </div>
        <button class="btn btn-ghost training-buy" ${can ? '' : 'disabled'}>${maxed ? '已满级' : '升级 <em>' + cost + ' P</em>'}</button>`;
      const ico = row.querySelector('.training-ico');
      const cv = document.createElement('canvas');
      cv.width = 48; cv.height = 48;
      SP.drawIcon(cv.getContext('2d'), tr.icon, 6, 6, 36, '#ffd24a', '#ffffff');
      ico.appendChild(cv);
      const btn = row.querySelector('button');
      btn.addEventListener('click', () => {
        if (Save.buyTraining(tr.id)) {
          G.Audio.play('levelup');
          UI.renderTraining();
          UI.refreshMenu();
          const g = UI.game;
          if (g) g.applySettings();
        } else {
          G.Audio.play('deny');
        }
      });
      wrap.appendChild(row);
    }
  };

  UI.resetAll = function () {
    if (!this._resetArmed) {
      this._resetArmed = true;
      this.toast('再次点击「重置全部存档」确认', 'pink');
      const btn = this.el['training-reset'];
      if (btn) btn.textContent = '确认重置？';
      setTimeout(() => {
        this._resetArmed = false;
        if (this.el['training-reset']) this.el['training-reset'].textContent = '重置全部存档';
      }, 3200);
      return;
    }
    Save.resetAll();
    this._resetArmed = false;
    if (this.el['training-reset']) this.el['training-reset'].textContent = '重置全部存档';
    this.renderTraining();
    this.renderCharacters();
    this.refreshMenu();
    this.toast('存档已清空。欢迎重新入职。', 'gold');
    G.Audio.play('levelup');
  };

  // ---------------- settings ----------------
  UI.openSettings = function (from) {
    this.returnFromSheet = from || (this.game && this.game.state === 'paused' ? 'pause' : 'menu');
    this.modalOpen = true;
    this.syncSettings();
    this.showScreen('settings');
    G.Audio.play('ui');
  };
  UI.closeSettings = function () {
    this.modalOpen = false;
    const el = this.el['screen-settings'];
    if (el) el.hidden = true;
    if (this.returnFromSheet === 'pause' && this.game && this.game.state === 'paused') this.showPause();
    else if (this.game && (this.game.state === 'gameover' || this.game.state === 'victory')) this.showScreen('over');
    else this.showMenu();
  };

  UI.syncSettings = function () {
    const s = Save.data.settings;
    if (this.el['set-music']) this.el['set-music'].value = Math.round(s.music * 100);
    if (this.el['set-sfx']) this.el['set-sfx'].value = Math.round(s.sfx * 100);
    if (this.el['set-shake']) this.el['set-shake'].classList.toggle('is-on', !!s.shake);
    if (this.el['set-autoaim']) this.el['set-autoaim'].classList.toggle('is-on', !!s.autoAim);
    if (this.el['set-autofire']) this.el['set-autofire'].classList.toggle('is-on', !!s.autoFire);
    if (this.el['set-automelee']) this.el['set-automelee'].classList.toggle('is-on', !!s.autoMelee);
    if (this.el['set-reducedfx']) this.el['set-reducedfx'].classList.toggle('is-on', !!s.reducedFx);
    if (this.el['set-crt']) this.el['set-crt'].classList.toggle('is-on', !!s.crt);
  };

  // ---------------- bind ----------------
  UI.bind = function () {
    const e = this.el;
    document.addEventListener('mouseover', (ev) => {
      const target = ev.target && ev.target.closest ? ev.target.closest('.icon-btn,.btn') : null;
      if (!target || target._hoverSfx) return;
      target._hoverSfx = true;
      G.Audio.play('hover');
    }, true);
    const click = (el, fn) => { if (el) el.addEventListener('click', (ev) => { ev.preventDefault(); G.Audio.play('ui'); fn(ev); }); };

    click(e['btn-start'], () => this.startFromMenu());
    click(e['btn-story-menu'], () => this.openStory('menu'));
    click(e['story-next'], () => this.nextStory());
    click(e['story-skip'], () => this.closeStory());
    click(e['btn-codex-menu'], () => this.openCodex('menu'));
    click(e['btn-manual-menu'], () => this.openManual('menu'));
    click(e['btn-dossier'], () => this.openDossier(this.char, 'menu'));
    click(e['btn-training-menu'], () => this.openTraining());
    click(e['btn-settings-menu'], () => this.openSettings('menu'));
    click(e['dossier-close'], () => this.closeDossier());
    click(e['dossier-pick'], () => this.pickDossier());
    click(e['manual-close'], () => this.closeManual());
    click(e['btn-pause-dossier'], () => { if (this.game && this.game.run) this.openDossier(this.game.run.character, 'pause'); });
    click(e['btn-pause-manual'], () => this.openManual('pause'));
    click(e['btn-sound'], () => {
      const s = Save.data.settings;
      s.muted = !s.muted;
      Save.saveSettings(s);
      if (this.game) { this.game.settings = s; this.game.applySettings(); }
      this.syncSettings();
    });
    click(e['btn-pause'], () => { if (this.game) this.game.pause(); });
    click(e['hud-build-btn'], () => { if (this.game) { this.game.pause(); this.updatePauseBuild(); } });
    click(e['btn-resume'], () => { if (this.game) this.game.resume(); });
    click(e['btn-pause-settings'], () => this.openSettings('pause'));
    click(e['btn-pause-quit'], () => {
      if (!this.game) return;
      this.hidePause();
      const g = this.game;
      if (g.state === 'paused') g.state = 'play';
      g.endRun(false);
    });
    click(e['btn-retry'], () => this.restartFromOver());
    click(e['btn-menu'], () => this.toMenu());
    click(e['btn-over-codex'], () => this.openCodex('over'));
    click(e['codex-close'], () => this.closeCodex());
    click(e['training-close'], () => this.closeTraining());
    click(e['training-reset'], () => this.resetAll());
    click(e['settings-close'], () => this.closeSettings());
    click(e['set-fullscreen'], () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen && document.exitFullscreen();
      }
    });
    if (e['codex-tabs']) {
      e['codex-tabs'].addEventListener('click', (ev) => {
        const t = ev.target.closest('.tab');
        if (!t) return;
        G.Audio.play('ui');
        this.renderCodex(t.dataset.tab);
      });
    }
    if (e['set-music']) {
      e['set-music'].addEventListener('input', (ev) => {
        const s = Save.data.settings;
        s.music = parseInt(ev.target.value, 10) / 100;
        Save.saveSettings(s);
        if (this.game) { this.game.settings = s; G.Audio.setMusic(s.music); }
      });
    }
    if (e['set-sfx']) {
      e['set-sfx'].addEventListener('input', (ev) => {
        const s = Save.data.settings;
        s.sfx = parseInt(ev.target.value, 10) / 100;
        Save.saveSettings(s);
        if (this.game) { this.game.settings = s; G.Audio.setSfx(s.sfx); }
      });
    }
    const toggles = [['set-shake', 'shake'], ['set-autoaim', 'autoAim'], ['set-autofire', 'autoFire'], ['set-automelee', 'autoMelee'], ['set-reducedfx', 'reducedFx'], ['set-crt', 'crt']];
    for (const [id, key] of toggles) {
      const el = e[id];
      if (!el) continue;
      el.addEventListener('click', () => {
        const s = Save.data.settings;
        s[key] = !s[key];
        Save.saveSettings(s);
        if (this.game) { this.game.settings = s; this.game.applySettings(); }
        this.syncSettings();
        G.Audio.play(s[key] ? 'ui2' : 'ui');
      });
    }
    // choice card keyboard covered by game; also direct delegation for shop etc is bound per card
  };

  // ---------------- dismiss modals from game keys ----------------
  UI.closeTopModal = function () {
    if (this.el['screen-story'] && !this.el['screen-story'].hidden) { this.closeStory(); return true; }
    if (this.el['screen-dossier'] && !this.el['screen-dossier'].hidden) { this.closeDossier(); return true; }
    if (this.el['screen-manual'] && !this.el['screen-manual'].hidden) { this.closeManual(); return true; }
    if (this.el['screen-codex'] && !this.el['screen-codex'].hidden) { this.closeCodex(); return true; }
    if (this.el['screen-training'] && !this.el['screen-training'].hidden) { this.closeTraining(); return true; }
    if (this.el['screen-settings'] && !this.el['screen-settings'].hidden) { this.closeSettings(); return true; }
    return false;
  };
})();
