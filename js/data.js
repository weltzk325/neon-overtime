/* ============================================================
   data.js — characters, weapons, upgrades, relics, enemies,
             rooms, events, training, codex entries
   ============================================================ */
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;

  const D = (G.DATA = {});

  // ---------------- characters ----------------
  D.characters = [
    {
      id: 'abigail',
      name: '阿比盖尔',
      en: 'ABIGAIL',
      title: '异常实习生',
      tag: 'DPS · 狙击',
      difficulty: '高爆发 · 低容错',
      hp: 92,
      speed: 272,
      crit: 0.1,
      defaultWeapon: 'laser',
      unlocked: true,
      art: 'assets/abigail_full.webp',
      desc: '能看见「死线」的实习生。眼底的青色比工牌还深，领口永远松着一颗扣子。<br><b>绿眼</b>：暴击率 +10%，移速更快，但血更薄。',
      lore: '她是这批实习生里唯一没有照片的人。入职表上写着「左眼异常，建议调离一线」，HR 把建议划掉了。连续三周没睡好，领口永远松着一颗扣子；HR 说她「影响办公室风气」，然后把她的工位调到了监控死角。',
      quote: '「加班费到账之前，我不会先倒下。」',
      traits: ['绿眼', '死线感知', '夜班体质', '松开的领口'],
      evaluation: { survival: 2, firepower: 5, mobility: 4, control: 3 },
      advice: '保持距离，用激光把异常串成一条线，再按 Q 一次切开。',
      note: '03:41，在茶水间对监控说「我看见你了」。HR 批注：建议保留，她至少还来上班。',
      skill: {
        id: 'deadline', name: '死线', en: 'DEADLINE', icon: 'deadline', cd: 16,
        tag: '处决 · 直线', cdText: '16 秒',
        short: '切开一条死线，处决残血异常。',
        desc: '蓄力 0.42 秒，沿瞄准方向切开一条死线：路径上的异常受到重创，生命低于 35% 的立即处决，并清除路径上的敌方弹幕。',
      },
      skill2: {
        id: 'gaze', name: '凝视', en: 'GAZE', icon: 'gaze', cd: 9,
        tag: '标记 · 增伤', cdText: '9 秒',
        short: '标记前方异常，增伤并减速。',
        desc: '凝视前方扇形内的异常 5 秒：它们受到的伤害 +30%，移动速度 -25%。',
      },
      bars: [2, 5, 4],
      color: '#8cffb0',
    },
    {
      id: 'ama',
      name: '阿码',
      en: 'AMA',
      title: '夜班程序员',
      tag: '近战 · 阵地',
      difficulty: '连段 · 续航',
      hp: 118,
      speed: 240,
      crit: 0.05,
      defaultWeapon: 'keyboard_melee',
      unlocked: true,
      unlockText: '',
      art: 'assets/ama_full.webp',
      desc: '把键盘当近战武器，编译一次要三条命。<br><b>键盘侠</b>：近战伤害更高，最大生命更高。',
      lore: '阿码在这栋楼里干了三年。工位上的绿植换了四盆，代码库换了三次，只有他还在。他管这叫「稳定版本」。',
      quote: '「先上线，再修。」',
      traits: ['夜班老兵', '耳机降噪', '键盘近战', '护肝片'],
      evaluation: { survival: 5, firepower: 4, mobility: 3, control: 4 },
      advice: '用三连键击贴脸输出，Q 丢终端拉火力，R 回车重击收尾。',
      note: '连续 36 小时未离开工位。HR 批注：已为其申请第二台显示器。',
      skill: {
        id: 'hotfix', name: '热修复', en: 'HOTFIX', icon: 'hotfix', cd: 20,
        tag: '召唤 · 守护', cdText: '20 秒',
        short: '部署终端炮塔，清弹幕并获护盾。',
        desc: '部署一台临时终端，持续 8 秒自动攻击最近的异常；部署时清除周围弹幕，并获得 15 点护盾。',
      },
      skill2: {
        id: 'enter', name: '回车重击', en: 'ENTER', icon: 'enter', cd: 9,
        tag: '突进 · 眩晕', cdText: '9 秒',
        short: '突进砸键盘，范围伤害并眩晕。',
        desc: '向前突进并砸下键盘，对落点周围的异常造成范围伤害，并眩晕 0.8 秒。',
      },
      bars: [5, 3, 3],
      color: '#57f4ff',
    },
  ];

  // ---------------- story / workplace satire ----------------
  D.story = [
    {
      title: '00:00 · 加班费未到账',
      text: '月底了，加班费还没到账。公告栏写着：『本月工资以积分形式发放，积分不可兑换。』你数了数账户余额：0.00。',
      note: '灵感：某企业不发工资发积分（2023）',
    },
    {
      title: '00:41 · 老板的办公室',
      text: '你去找老板。门缝里透出红光。他刚把『裁员』改成『毕业』，把『加班』改成『奋斗』，把『两小时不回消息』改成『严重违纪』。你敲门的手停住了。',
      note: '灵感：裁员称毕业；两小时不回群消息扣 20 元',
    },
    {
      title: '00:42 · 异常发生',
      text: '门开了。老板变成了一台会打印周报的怪物，同事们变成了纸团、打印机和续命尸。你的左眼看见了一条线——死线。',
      note: '灵感：如厕超时被辞、门缝拍照取证；卡点下班罚 500 元',
    },
    {
      title: '00:43 · 目标：天台',
      text: '你只想要回加班费。既然公司不讲劳动法，那就用办公用品讲。清空六层楼，上天台，把周报魔王 KPI-0 写进离职申请。',
      note: '本故事根据真实离谱职场案例改编。加班费，请依法支付。',
    },
  ];

  D.roomQuotes = [
    'HR：加班费已折算为积分，可在食堂抵扣。',
    '主管：年轻人不要总想着钱，要多想想成长。',
    '行政：厕所计时器已安装，超时自动开门。',
    '财务：报销单下辈子到账。',
    '老板：公司不养闲人，但可以养闲鬼。',
    '前台：谁先走，明天就不用来了。',
    'IT：迟开电脑 8 分钟，算严重违纪。',
    '同事：这个需求很简单，怎么实现我不管。',
  ];

  // ---------------- weapons ----------------
  D.weapons = {
    keyboard: {
      id: 'keyboard',
      name: '机械键盘',
      en: 'MECH KEYBOARD',
      icon: 'keyboard',
      color: '#57f4ff',
      damage: 8.2,
      cooldown: 0.185,
      speed: 820,
      count: 1,
      spread: 0.035,
      bulletSize: 4,
      life: 0.72,
      pierce: 0,
      knock: 26,
      auto: true,
      tags: ['高速', '直线'],
      desc: '每秒 5.4 次按键飞弹。手速就是正义。',
      long: '把每一次敲击都发射出去。射速极快，弹道笔直，适合边跑边打。',
      stats: '伤害 8.2 · 射速 5.4/s · 弹速 820',
    },
    stapler: {
      id: 'stapler',
      name: '订书机',
      en: 'STAPLER SHOTGUN',
      icon: 'stapler',
      color: '#ffd24a',
      damage: 9.5,
      cooldown: 0.72,
      speed: 660,
      count: 5,
      spread: 0.42,
      bulletSize: 5,
      life: 0.36,
      pierce: 0,
      knock: 80,
      auto: true,
      tags: ['散射', '击退'],
      desc: '五连钢钉，贴脸能把主管钉在墙上。',
      long: '扇形喷出五枚钢钉，近距离全中时伤害爆炸，并强力击退。',
      stats: '伤害 9.5×5 · 射速 1.4/s · 射程短',
    },
    laser: {
      id: 'laser',
      name: '激光笔',
      en: 'GREEN LASER',
      icon: 'laser',
      color: '#8cffb0',
      beam: true,
      tickDamage: 4.0,
      tickRate: 0.085,
      range: 660,
      beamWidth: 5,
      tags: ['穿透', '持续'],
      desc: '持续穿透异常，实体家具会挡住光束。留意热量。',
      long: '按住射击，持续接触造成稳定伤害，每 0.1 秒结算；可穿透异常，家具与墙壁阻挡。约 6 秒过热，松手散热，热量降至 25% 后解除过热。',
      stats: '基础 47.1 DPS · 穿透异常 · 射程 660 · 热量限制',
    },
    keyboard_melee: {
      id: 'keyboard_melee',
      name: '战损键盘',
      en: 'BROKEN KEYBOARD',
      icon: 'keyboard',
      color: '#57f4ff',
      melee: true,
      damage: 18,
      cooldown: 0.46,
      range: 82,
      arc: 1.65,
      knock: 230,
      combo: 3,
      tags: ['近战', '连段'],
      desc: '键帽飞了，键盘还能砸人。',
      long: '单击挥砍，连续点击衔接三连键击：前两下快，第三下重击并击退。闪避可取消攻击，设置中可开启自动近战辅助。',
      stats: '伤害 18/18/30.6 · 近战 82 · 手动三连击',
    },
  };

  // ---------------- stats factory ----------------
  D.makeStats = function () {
    return {
      damage: 1,
      fireRate: 1,
      speed: 1,
      crit: 0,
      critMult: 1.5,
      projectile: 0,
      pierce: 0,
      bulletSpeed: 1,
      bulletSize: 1,
      knock: 1,
      xpGain: 1,
      goldGain: 1,
      armor: 0,
      pickup: 110,
      luck: 0,
      dodgeCd: 1.6,
      dodgeBlast: false,
      lifesteal: 0,
      explodeOnKill: 0,
      autoNova: false,
      bulletTime: false,
      revive: 0,
      skillCd: 14,
      skill2Cd: 9,
      skillPower: 1,
      skill2Power: 1,
      dashCharges: 1,
      dashDamage: 0,
      meleePower: 1,
      meleeRange: 1,
      meleeSpeed: 1,
      meleeThirdBlast: 0,
      turretRate: 1,
      turretDuration: 0,
      skillEcho: 0,
      execHeal: 0,
      gazeAmp: 0.3,
      gazeDuration: 5,
      enterRadius: 1,
      enterStun: 0.8,
      fearChance: 0,
      immuneChance: 0,
      healOnRoom: 0,
      wpnDamage: 1,
      eliteHint: 0,
    };
  };

  // ---------------- upgrades ----------------
  // rarity: common / rare / epic / legend
  D.upgrades = [
    {
      id: 'raise', name: '加薪申请', en: 'RAISE REQUEST', rarity: 'common', icon: 'damage', max: 6,
      desc: '伤害 +12%',
      flavor: 'HR 说今年没有预算。你把申请表折成了刀。',
      tags: ['伤害'],
      apply(run) { run.stats.damage += 0.12; },
    },
    {
      id: 'hotkey', name: '快捷键', en: 'HOTKEY', rarity: 'common', icon: 'rate', max: 6,
      desc: '攻击速度 +12%',
      flavor: 'Ctrl+S 已经刻进肌肉记忆。',
      tags: ['攻速'],
      apply(run) { run.stats.fireRate += 0.12; },
    },
    {
      id: 'sneakers', name: '通勤跑鞋', en: 'COMMUTER SHOES', rarity: 'common', icon: 'speed', max: 6,
      desc: '移动速度 +8%',
      flavor: '赶最后一班地铁练出来的。',
      tags: ['移速'],
      apply(run) { run.stats.speed += 0.08; },
    },
    {
      id: 'cushion', name: '工位护垫', en: 'LUMBAR PILLOW', rarity: 'common', icon: 'hp', max: 6,
      desc: '最大生命 +16，并回复 16 生命',
      flavor: '腰不疼了，命也硬了。',
      tags: ['生命'],
      apply(run) { run.maxHp += 16; run.hp = Math.min(run.maxHp, run.hp + 16); },
    },
    {
      id: 'glasses', name: '防蓝光眼镜', en: 'BLUE LIGHT FILTER', rarity: 'common', icon: 'crit', max: 5,
      desc: '暴击率 +6%',
      flavor: '看得更清楚，也更容易找到要害。',
      tags: ['暴击'],
      apply(run) { run.stats.crit += 0.06; },
    },
    {
      id: 'bonus', name: '绩效奖金', en: 'PERFORMANCE BONUS', rarity: 'common', icon: 'gold', max: 5,
      desc: '金币获取 +22%',
      flavor: '以积分形式发放，可在食堂抵扣。',
      tags: ['经济'],
      apply(run) { run.stats.goldGain += 0.22; },
    },
    {
      id: 'vacuum', name: '桌面吸尘器', en: 'DESK VACUUM', rarity: 'common', icon: 'magnet', max: 4,
      desc: '拾取范围 +35，经验获取 +10%',
      flavor: '连同事的薯片渣都不放过。',
      tags: ['拾取'],
      apply(run) { run.stats.pickup += 35; run.stats.xpGain += 0.1; },
    },
    {
      id: 'double', name: '双显示器', en: 'DUAL MONITOR', rarity: 'rare', icon: 'multi', max: 3,
      desc: '投射物 +1，伤害 -6%',
      flavor: '一屏写代码，一屏看股价。',
      tags: ['多重射击'],
      apply(run) { run.stats.projectile += 1; run.stats.damage -= 0.06; },
    },
    {
      id: 'paperclip', name: '穿甲回形针', en: 'ARMOR-PIERCING CLIP', rarity: 'rare', icon: 'pierce', max: 3,
      desc: '穿透 +1，弹速 +10%',
      flavor: '形状决定命运。',
      tags: ['穿透'],
      apply(run) { run.stats.pierce += 1; run.stats.bulletSpeed += 0.1; },
    },
    {
      id: 'popcorn', name: '微波炉爆米花', en: 'MICROWAVE POPCORN', rarity: 'rare', icon: 'explode', max: 4,
      desc: '击杀时 22% 概率引发小爆炸',
      flavor: '公司微波炉的遗物，加热时会尖叫。',
      tags: ['爆炸'],
      apply(run) { run.stats.explodeOnKill += 0.22; },
    },
    {
      id: 'caffeine', name: '咖啡因过量', en: 'CAFFEINE OVERDOSE', rarity: 'rare', icon: 'coffee', max: 3,
      desc: '移动速度 +16%，攻击速度 +8%，最大生命 -6',
      flavor: '心跳 140，手不抖。',
      tags: ['移速', '风险'],
      apply(run) { run.stats.speed += 0.16; run.stats.fireRate += 0.08; run.maxHp -= 6; run.hp = Math.min(run.hp, run.maxHp); },
    },
    {
      id: 'flextime', name: '弹性工作制', en: 'FLEXIBLE HOURS', rarity: 'rare', icon: 'dash', max: 4,
      desc: '闪避冷却 -18%',
      flavor: '理论上可以四点下班。理论上。',
      tags: ['闪避'],
      apply(run) { run.stats.dodgeCd *= 0.82; },
    },
    {
      id: 'ergo', name: '人体工学椅', en: 'ERGONOMIC CHAIR', rarity: 'rare', icon: 'shield', max: 4,
      desc: '最大生命 +22，受到伤害 -6%',
      flavor: '十二向调节，唯一的缺点是它属于公司。',
      tags: ['生命', '减伤'],
      apply(run) { run.maxHp += 22; run.hp = Math.min(run.maxHp, run.hp + 22); run.stats.armor += 0.06; },
    },
    {
      id: 'clockout', name: '强制下班', en: 'FORCED CLOCK-OUT', rarity: 'epic', icon: 'dash', max: 1,
      desc: '闪避结束时引爆一圈冲击波（120 伤害）',
      flavor: '打卡机发出惨叫，整层楼都听见了。',
      tags: ['闪避', '爆炸'],
      apply(run) { run.stats.dodgeBlast = true; },
    },
    {
      id: 'ctrl-c', name: 'Ctrl+C', en: 'CTRL+C', rarity: 'epic', icon: 'multi', max: 2,
      desc: '投射物 +2，攻击速度 -8%',
      flavor: '复制粘贴，是这个世界运行的方式。',
      tags: ['多重射击'],
      apply(run) { run.stats.projectile += 2; run.stats.fireRate -= 0.08; },
    },
    {
      id: 'kpi', name: 'KPI 反噬', en: 'KPI BACKLASH', rarity: 'epic', icon: 'crit', max: 3,
      desc: '暴击率 +12%，暴击伤害 +30%',
      flavor: '数字会咬人，尤其是红色的。',
      tags: ['暴击'],
      apply(run) { run.stats.crit += 0.12; run.stats.critMult += 0.3; },
    },
    {
      id: 'refill', name: '无限续杯', en: 'BOTTOMLESS REFILL', rarity: 'epic', icon: 'coffee', max: 2,
      desc: '击杀回复 2 点生命',
      flavor: '咖啡机的水箱通向异次元。',
      tags: ['续航'],
      apply(run) { run.stats.lifesteal += 2; },
    },
    {
      id: 'union', name: '工会之怒', en: 'UNION FURY', rarity: 'epic', icon: 'skill', max: 2,
      desc: '角色技能效果 +60%，冷却 -20%',
      flavor: '全体注意，去一楼集合。',
      tags: ['技能'],
      apply(run) { run.stats.skillPower += 0.6; run.stats.skillCd *= 0.8; },
    },
    {
      id: 'firework', name: '年底烟花', en: 'YEAR-END FIREWORKS', rarity: 'epic', icon: 'explode', max: 1,
      desc: '击杀时额外 30% 概率爆炸，爆炸范围 +50%',
      flavor: '财务部说这不算团建预算。',
      tags: ['爆炸'],
      apply(run) { run.stats.explodeOnKill += 0.3; run.stats.explodeSize = (run.stats.explodeSize || 1) + 0.5; },
    },
    {
      id: 'fired', name: '开除通知', en: 'PINK SLIP', rarity: 'legend', icon: 'crown', max: 1,
      desc: '每 9 秒自动释放一次超能冲击波',
      flavor: '你被开除了。整栋楼都是。',
      tags: ['传说', '自动'],
      apply(run) { run.stats.autoNova = true; },
    },
    {
      id: 'timelord', name: '时间管理大师', en: 'TIME MANAGEMENT', rarity: 'legend', icon: 'clock', max: 1,
      desc: '闪避冷却 -45%，闪避时让子弹变慢',
      flavor: '把 8 小时活成 26 小时。',
      tags: ['传说', '闪避'],
      apply(run) { run.stats.dodgeCd *= 0.55; run.stats.bulletTime = true; },
    },
    {
      id: 'waiver', name: '周报豁免', en: 'WEEKLY REPORT WAIVER', rarity: 'legend', icon: 'shield', max: 1,
      desc: '致命伤害免疫一次，并回复 30% 生命',
      flavor: '有人在周报里替你写好了这一周。',
      tags: ['传说', '保命'],
      apply(run) { run.stats.revive += 1; },
    },
    {
      id: 'fullstack', name: '全栈超人', en: 'FULL-STACK HERO', rarity: 'legend', icon: 'star', max: 1,
      desc: '伤害、攻速、移速、生命全部 +12%',
      flavor: '前端、后端、运维、保洁，你都会。',
      tags: ['传说', '全能'],
      apply(run) {
        run.stats.damage += 0.12; run.stats.fireRate += 0.12; run.stats.speed += 0.12;
        run.maxHp = Math.round(run.maxHp * 1.12); run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * 0.12));
      },
    },
    {
      id: 'skill_cd', name: '技能充能', en: 'COOLDOWN SYNC', rarity: 'rare', icon: 'clock', max: 4, skill: true,
      desc: '两个角色技能的冷却 -15%',
      flavor: '把会议纪要拖进回收站，时间就省出来了。',
      tags: ['技能', '冷却'],
      apply(run) { run.stats.skillCd *= 0.85; run.stats.skill2Cd *= 0.85; },
    },
    {
      id: 'dash_charge', name: '二段闪避', en: 'DOUBLE DODGE', rarity: 'epic', icon: 'dash', max: 2, skill: true,
      desc: '闪避次数 +1（连续翻滚，独立充能）',
      flavor: '只要滚得够快，绩效就追不上你。',
      tags: ['技能', '闪避'],
      apply(run) { run.stats.dashCharges += 1; },
    },
    {
      id: 'dash_blade', name: '跑路带刀', en: 'RUNNING BLADE', rarity: 'rare', icon: 'dash', max: 3, skill: true,
      desc: '闪避穿过异常时造成 16 伤害',
      flavor: '离职面谈上学的防身术。',
      tags: ['技能', '闪避'],
      apply(run) { run.stats.dashDamage += 16; },
    },
    {
      id: 'melee_plus', name: '键盘侠', en: 'KEYBOARD WARRIOR', rarity: 'rare', icon: 'keyboard', max: 4, skill: true,
      desc: '近战伤害 +35%，近战范围 +15%',
      flavor: '在群里重拳出击，在现实中也是。',
      tags: ['技能', '近战'],
      apply(run) { run.stats.meleePower += 0.35; run.stats.meleeRange += 0.15; },
    },
    {
      id: 'combo', name: '连击节拍', en: 'COMBO BEAT', rarity: 'epic', icon: 'rate', max: 2, skill: true,
      desc: '近战连段速度 +25%，第三击引发冲击波',
      flavor: '键盘敲得越快，HR 越不敢靠近。',
      tags: ['技能', '近战'],
      apply(run) { run.stats.meleeSpeed += 0.25; run.stats.meleeThirdBlast += 1; },
    },
    {
      id: 'turret', name: '终端超频', en: 'OVERCLOCK', rarity: 'rare', icon: 'hotfix', max: 3, skill: true,
      desc: '热修复炮塔持续时间 +2 秒，射速 +35%',
      flavor: '风扇在尖叫，但还能再跑一个任务。',
      tags: ['技能', '召唤'],
      apply(run) { run.stats.turretRate += 0.35; run.stats.turretDuration += 2; },
    },
    {
      id: 'echo', name: '技能回响', en: 'ECHO', rarity: 'epic', icon: 'skill', max: 2, skill: true,
      desc: '释放技能时 25% 概率返还 50% 冷却',
      flavor: '会议开完了，但会议纪要又长了出来。',
      tags: ['技能', '冷却'],
      apply(run) { run.stats.skillEcho += 0.25; },
    },
    {
      id: 'exec', name: '处决回血', en: 'EXECUTION HEAL', rarity: 'rare', icon: 'heart', max: 3, skill: true,
      desc: '死线处决异常时回复 6 生命',
      flavor: '把同事的加班餐吃了，也是一种续航。',
      tags: ['技能', '续航'],
      apply(run) { run.stats.execHeal += 6; },
    },
    {
      id: 'gaze_deep', name: '凝视加深', en: 'DEEPER GAZE', rarity: 'epic', icon: 'gaze', max: 2, skill: true,
      desc: '凝视增伤 +10%，持续时间 +2 秒',
      flavor: '看得越久，越知道谁在摸鱼。',
      tags: ['技能', '标记'],
      apply(run) { run.stats.gazeAmp += 0.1; run.stats.gazeDuration += 2; },
    },
    {
      id: 'enter_plus', name: '回车蓄力', en: 'HARD ENTER', rarity: 'rare', icon: 'enter', max: 3, skill: true,
      desc: '回车重击范围 +25%，眩晕 +0.4 秒',
      flavor: '这一下回车，发送的是你的辞职信。',
      tags: ['技能', '近战'],
      apply(run) { run.stats.enterRadius += 0.25; run.stats.enterStun += 0.4; },
    },
  ];

  D.rarity = {
    common: { name: '普通', weight: 50, color: '#a9b8cf' },
    rare: { name: '稀有', weight: 27, color: '#39f4ff' },
    epic: { name: '史诗', weight: 16, color: '#b388ff' },
    legend: { name: '传说', weight: 6, color: '#ffd24a' },
  };

  // ---------------- relics ----------------
  D.relics = [
    {
      id: 'hr_seal', name: '人事的红章', en: 'HR SEAL', icon: 'crown', rarity: 'epic',
      desc: '暴击率 +10%',
      flavor: '盖下去的一瞬间，你的绩效考核就结束了。',
      apply(run) { run.stats.crit += 0.1; },
    },
    {
      id: 'badge', name: '工牌 NO.001', en: 'BADGE 001', icon: 'gold', rarity: 'rare',
      desc: '金币获取 +35%',
      flavor: '照片上的人似乎不是你。',
      apply(run) { run.stats.goldGain += 0.35; },
    },
    {
      id: 'filter', name: '咖啡机滤芯', en: 'COFFEE FILTER', icon: 'coffee', rarity: 'rare',
      desc: '每清空一个房间回复 18 生命',
      flavor: '滤芯里长出了一小片森林。',
      apply(run) { run.stats.healOnRoom += 18; },
    },
    {
      id: 'wig', name: '老板的假发', en: 'BOSS TOUPEE', icon: 'star', rarity: 'epic',
      desc: '敌人有 12% 概率陷入恐惧',
      flavor: '戴上它，你就是这层楼最像老板的人。',
      apply(run) { run.stats.fearChance += 0.12; },
    },
    {
      id: 'nda', name: '保密协议', en: 'NDA', icon: 'paper', rarity: 'epic',
      desc: '20% 概率完全免疫伤害',
      flavor: '第 8 条：员工不得在死后泄露公司信息。',
      apply(run) { run.stats.immuneChance += 0.2; },
    },
    {
      id: 'photo', name: '团建合照', en: 'TEAM PHOTO', icon: 'heart', rarity: 'rare',
      desc: '每持有一件遗物，伤害 +4%',
      flavor: '后排左边那个人已经不在了。',
      apply(run) { run.stats.photoBonus = true; },
    },
    {
      id: 'resign', name: '离职申请书', en: 'RESIGNATION', icon: 'shield', rarity: 'legend',
      desc: '致命伤害免疫一次，回复 25% 生命',
      flavor: '始终没有交出去。',
      apply(run) { run.stats.revive += 1; },
    },
    {
      id: 'drive', name: '神秘硬盘', en: 'UNKNOWN DRIVE', icon: 'xp', rarity: 'epic',
      desc: '经验 +40%，但敌人生命 +10%',
      flavor: '标签上写着「不要打开」。',
      apply(run) { run.stats.xpGain += 0.4; run.enemyHpBonus = (run.enemyHpBonus || 0) + 0.1; },
    },
    {
      id: 'gold_stapler', name: '黄金订书机', en: 'GOLDEN STAPLER', icon: 'gold', rarity: 'rare',
      desc: '武器伤害 +15%',
      flavor: '年会抽奖的一等奖，可能值 30 块。',
      apply(run) { run.stats.wpnDamage += 0.15; },
    },
    {
      id: 'cat', name: '招财猫', en: 'LUCKY CAT', icon: 'luck', rarity: 'rare',
      desc: '金币 +25%，幸运 +10%',
      flavor: '它一直在招手，没人知道在招什么。',
      apply(run) { run.stats.goldGain += 0.25; run.stats.luck += 0.1; },
    },
  ];

  // ---------------- enemies ----------------
  D.enemies = {
    paper: {
      id: 'paper', name: '复印件', en: 'COPY', hp: 24, speed: 82, radius: 13, damage: 8,
      xp: 4, gold: 2, score: 8, sprite: 'paper', ai: 'chase',
      desc: '被反复复印废掉的合同，有了自己的意识。喜欢贴着人飞。',
      tip: '靠近后会加速，别让它围成一圈。',
    },
    printer: {
      id: 'printer', name: '打印兽', en: 'PRINTZILLA', hp: 44, speed: 44, radius: 16, damage: 10,
      xp: 7, gold: 3, score: 14, sprite: 'printer', ai: 'ranged',
      fireRate: 2.2, bulletSpeed: 210, bulletDamage: 9, preferred: 300,
      desc: '卡纸三天后进化出的捕食者。会朝你吐出刚打印好的死亡通知。',
      tip: '拉开距离或绕到它侧后方，它的出纸口不会转弯。',
    },
    zombie: {
      id: 'zombie', name: '续命尸', en: 'CAFFEINE ZOMBIE', hp: 58, speed: 58, radius: 14, damage: 14,
      xp: 8, gold: 4, score: 18, sprite: 'zombie', ai: 'charger',
      windup: 0.62, chargeSpeed: 520, chargeTime: 0.32,
      desc: '第 72 小时还在改需求的前辈。闻到咖啡味就会冲刺。',
      tip: '红光锁定后立刻横向闪避，冲刺有硬直。',
    },
    ghost: {
      id: 'ghost', name: '加班魂', en: 'OVERTIME GHOST', hp: 36, speed: 96, radius: 13, damage: 9,
      xp: 8, gold: 3, score: 16, sprite: 'ghost', ai: 'ghost',
      fireRate: 2.6, bulletSpeed: 150, bulletDamage: 8, preferred: 220,
      desc: '没有通过试用期的员工，至今还在群里回「收到」。',
      tip: '它的幽火会追踪，但可以被障碍挡下。',
    },
    drone: {
      id: 'drone', name: '监控眼', en: 'WATCHER', hp: 46, speed: 88, radius: 13, damage: 9,
      xp: 7, gold: 3, score: 15, sprite: 'drone', ai: 'strafer',
      fireRate: 2.4, bulletSpeed: 300, bulletDamage: 7, burst: 3, preferred: 320,
      desc: '行政部新装的考勤摄像头。它会记录你的每一次摸鱼。',
      tip: '它会保持距离横向移动，用穿透或爆炸武器应付。',
    },
    supervisor: {
      id: 'supervisor', name: '主管', en: 'SUPERVISOR', hp: 230, speed: 52, radius: 22, damage: 18,
      xp: 34, gold: 18, score: 80, sprite: 'supervisor', ai: 'boss_lite', elite: true,
      fireRate: 2.8, bulletSpeed: 240, bulletDamage: 12, summon: true,
      desc: '中层管理者，会同时使用报表弹幕和口头 PUA。有护盾，会召唤下属。',
      tip: '先清小怪再集火。它的护盾会在召唤时短暂失效。',
    },
  };

  D.boss = {
    id: 'deadline', name: '周报魔王 · KPI-0', en: 'KPI-0', hp: 2600,
    desc: '这栋楼的第零号员工。每一份周报都是它的一块肉。',
    tip: '三个阶段：报表弹幕、盖章追踪、狂暴全屏。红圈出现就闪。',
  };

  // ---------------- room themes ----------------
  D.themes = {
    office: {
      id: 'office', name: '工位区', en: 'OPEN OFFICE', floor: '1F',
      wall: '#111b2a', wallHi: '#1b2c42', wallLo: '#0a121d',
      floorA: '#111b29', floorB: '#0a111c', tile: 'rgba(110,180,240,0.055)',
      neon: '#57f4ff', accent: '#ff3d81', lamp: '#bdefff',
      window: '#071826', winCity: ['#0d3550', '#14506b', '#0a2538'],
      fog: 'rgba(87,244,255,0.045)',
      objs: ['desk', 'desk', 'partition', 'plant', 'cabinet', 'server', 'boxes', 'desk'],
      wallDeco: ['clock', 'exit', 'poster', 'logo'],
    },
    pantry: {
      id: 'pantry', name: '茶水间', en: 'PANTRY', floor: '2F',
      wall: '#221a19', wallHi: '#352825', wallLo: '#130e0e',
      floorA: '#1c1717', floorB: '#100b0c', tile: 'rgba(255,190,130,0.06)',
      neon: '#ffb35c', accent: '#ff3d5e', lamp: '#ffd9a8',
      window: '#160f13', winCity: ['#3a2118', '#5a3420', '#2a1712'],
      fog: 'rgba(255,170,90,0.05)',
      objs: ['cooler', 'table', 'fridge', 'cabinet', 'plant', 'sofa', 'boxes'],
      wallDeco: ['menu', 'clock', 'poster', 'exit'],
    },
    meeting: {
      id: 'meeting', name: '会议室', en: 'MEETING ROOM', floor: '2F',
      wall: '#1a1526', wallHi: '#2a213c', wallLo: '#0d0a15',
      floorA: '#171225', floorB: '#0c0914', tile: 'rgba(190,150,255,0.06)',
      neon: '#b388ff', accent: '#ff3d81', lamp: '#e6d6ff',
      window: '#0a0a1c', winCity: ['#241a45', '#3a2a66', '#181033'],
      fog: 'rgba(179,136,255,0.05)',
      objs: ['table', 'cabinet', 'whiteboard', 'plant', 'boxes', 'table'],
      wallDeco: ['screen', 'clock', 'poster', 'logo'],
    },
    exec: {
      id: 'exec', name: 'CEO 办公室', en: 'EXECUTIVE FLOOR', floor: '3F',
      wall: '#1f1418', wallHi: '#33212a', wallLo: '#120a0e',
      floorA: '#1a1015', floorB: '#0d070a', tile: 'rgba(255,90,90,0.055)',
      neon: '#ff3d5e', accent: '#ffd24a', lamp: '#ffc9b0',
      window: '#120a18', winCity: ['#3a1226', '#5c1a35', '#2a0d1c'],
      fog: 'rgba(255,60,90,0.05)',
      objs: ['bossdesk', 'sofa', 'plant', 'cabinet', 'server', 'table'],
      wallDeco: ['logo', 'clock', 'screen', 'poster'],
    },
  };

  D.rooms = [
    { theme: 'office', label: '工位区 A', code: '1F-A' },
    { theme: 'pantry', label: '茶水间', code: '1F-B' },
    { theme: 'meeting', label: '会议室 3', code: '2F-A' },
    { theme: 'office', label: '开放办公层', code: '2F-B' },
    { theme: 'exec', label: '高管走廊', code: '3F-A' },
    { theme: 'exec', label: 'CEO 办公室', code: '3F-B' },
  ];
  D.BOSS_ROOM = { theme: 'exec', label: '天台 · CEO 办公室', code: 'RF' };

  D.roomLabel = function (i) {
    if (i >= D.rooms.length) return D.BOSS_ROOM.label;
    return D.rooms[i].label;
  };

  // ---------------- door types ----------------
  D.doors = {
    battle: { id: 'battle', name: '继续深入', en: 'PUSH ON', icon: 'damage', color: '#57f4ff', desc: '更多异常，更多资源' },
    elite: { id: 'elite', name: '主管办公室', en: 'ELITE', icon: 'crown', color: '#ffd24a', desc: '精英战斗 · 必掉遗物' },
    treasure: { id: 'treasure', name: '资料室', en: 'ARCHIVE', icon: 'gold', color: '#ffd24a', desc: '宝箱 · 金币与升级' },
    event: { id: 'event', name: '异常房间', en: 'ANOMALY', icon: 'paper', color: '#b388ff', desc: '随机事件' },
    rest: { id: 'rest', name: '吸烟区', en: 'SMOKE BREAK', icon: 'coffee', color: '#a6ff5e', desc: '回复 30% 生命' },
    shop: { id: 'shop', name: '自动贩卖区', en: 'VENDING', icon: 'gold', color: '#ff3d81', desc: '金币购买补给' },
    boss: { id: 'boss', name: '天台', en: 'FINAL', icon: 'crown', color: '#ff3d5e', desc: '周报魔王' },
  };

  // ---------------- events ----------------
  D.events = [
    {
      id: 'vending',
      title: '自动售货机',
      eyebrow: 'ANOMALY / 03',
      text: '角落里有一台没有插电的售货机，屏幕上滚动着你的名字。投币口在发热。',
      options: [
        {
          label: '投 ¥40', desc: '获得一个随机稀有以上升级', price: 40,
          can: (run) => run.gold >= 40,
          apply(run, game) { run.gold -= 40; game.grantUpgrade(['rare', 'epic', 'legend']); },
        },
        {
          label: '踹它一脚', desc: '回复 18 生命，掉落 ¥15', 
          apply(run, game) { game.healPlayer(18); run.gold += 15; game.toast('售货机吐出了硬币和一声呜咽', 'gold'); },
        },
        { label: '离开', desc: '什么也不发生', apply() {} },
      ],
    },
    {
      id: 'hr',
      title: 'HR 的约谈',
      eyebrow: 'HR / CONFIDENTIAL',
      text: '人事主管坐在没有灯的会议室里，把一份文件推到你面前。「签了它，你会变得更强。」',
      options: [
        {
          label: '签字', desc: '最大生命 -18，获得一个传说升级', 
          apply(run, game) { run.maxHp = Math.max(40, run.maxHp - 18); run.hp = Math.min(run.hp, run.maxHp); game.grantUpgrade(['legend']); },
        },
        {
          label: '拒绝', desc: '获得 ¥45', 
          apply(run, game) { run.gold += 45; game.toast('HR 说「你会后悔的」', 'pink'); },
        },
      ],
    },
    {
      id: 'phone',
      title: '凌晨三点的来电',
      eyebrow: 'INCOMING CALL',
      text: '座机响了。来电显示是「你自己」。听筒里传来键盘声，还有一句很轻的「别上来」。',
      options: [
        {
          label: '接听', desc: '获得一件遗物，但下一房间敌人强化', 
          apply(run, game) { run.curseNextRoom = 0.2; game.grantRelicChoice(); },
        },
        { label: '挂断', desc: '回复 26 生命', apply(run, game) { game.healPlayer(26); } },
      ],
    },
    {
      id: 'cleaner',
      title: '保洁阿姨',
      eyebrow: 'NIGHT SHIFT',
      text: '阿姨把拖把靠在墙上，递给你一杯温热的汤。「喝完再上去吧，顶楼那个东西，今晚特别饿。」',
      options: [
        {
          label: '喝汤', desc: '回满生命，下一房间敌人速度 +10%', 
          apply(run, game) { game.healPlayer(run.maxHp); run.curseNextRoomSpeed = 0.1; game.toast('喝下热汤 · 回复受当前合同规则影响', 'gold'); },
        },
        {
          label: '帮忙拖地', desc: '获得 ¥60 和护盾 30', 
          apply(run, game) { run.gold += 60; game.addShield(30); },
        },
      ],
    },
  ];

  // ---------------- meta training ----------------
  D.training = [
    { id: 'vit', name: '员工体质', en: 'STAMINA', icon: 'hp', max: 5, cost: (lv) => 80 + lv * 70, desc: '每级最大生命 +8', apply(run, lv) { run.maxHp += lv * 8; run.hp += lv * 8; } },
    { id: 'eff', name: '工作效率', en: 'EFFICIENCY', icon: 'damage', max: 5, cost: (lv) => 100 + lv * 85, desc: '每级伤害 +4%', apply(run, lv) { run.stats.damage += lv * 0.04; } },
    { id: 'luck', name: '办公室玄学', en: 'LUCK', icon: 'luck', max: 5, cost: (lv) => 90 + lv * 75, desc: '每级暴击 +2%，金币/经验 +6%', apply(run, lv) { run.stats.crit += lv * 0.02; run.stats.goldGain += lv * 0.06; run.stats.xpGain += lv * 0.06; } },
  ];

  // ---------------- codex ----------------
  D.codex = {
    enemies: [
      { id: 'paper', ...D.enemies.paper },
      { id: 'printer', ...D.enemies.printer },
      { id: 'zombie', ...D.enemies.zombie },
      { id: 'ghost', ...D.enemies.ghost },
      { id: 'drone', ...D.enemies.drone },
      { id: 'supervisor', ...D.enemies.supervisor },
      { id: 'deadline', name: '周报魔王 · KPI-0', en: 'KPI-0', desc: D.boss.desc, tip: D.boss.tip, boss: true },
    ],
    weapons: Object.values(D.weapons).map((w) => ({ id: w.id, name: w.name, en: w.en, desc: w.long, tip: w.stats, icon: w.icon })),
    relics: D.relics.map((r) => ({ id: r.id, name: r.name, en: r.en, desc: r.desc, tip: r.flavor, icon: r.icon, rarity: r.rarity })),
    characters: D.characters.map((c) => ({
      id: c.id, name: c.name, en: c.en, title: c.title, tag: c.tag,
      desc: c.lore, tip: c.quote, skill: c.skill, skill2: c.skill2, art: c.art, color: c.color,
      unlockText: c.unlockText || '',
    })),
  };

  // ---------------- enemy pool per room ----------------
  D.roomPools = [
    ['paper', 'printer'],
    ['paper', 'printer', 'zombie'],
    ['printer', 'zombie', 'ghost'],
    ['paper', 'zombie', 'ghost', 'drone'],
    ['zombie', 'ghost', 'drone', 'printer'],
    ['zombie', 'drone', 'ghost', 'supervisor'],
  ];

  D.wavesForRoom = function (idx, kind) {
    const base = 3 + Math.floor(idx * 0.9);
    if (kind === 'rest') return { waves: [{ count: 2 + (idx > 3 ? 1 : 0), pool: ['paper'] }], hpMul: 1 };
    if (kind === 'elite') return { waves: [{ count: 3 + (idx > 3 ? 1 : 0), pool: ['paper', 'zombie', 'printer'] }, { count: 1, pool: ['supervisor'], eliteWave: true }], hpMul: 1.15 };
    if (idx === 0) return { waves: [{ count: 4, pool: ['paper'] }, { count: 5, pool: ['paper', 'printer'] }], hpMul: 0.9 };
    if (idx === 1) return { waves: [{ count: 5, pool: ['paper', 'printer'] }, { count: 6, pool: ['paper', 'zombie'] }], hpMul: 1 };
    const n = 2 + (idx >= 3 ? 1 : 0);
    const waves = [];
    for (let i = 0; i < n; i++) waves.push({ count: base + i, pool: D.roomPools[Math.min(idx, 5)] });
    return { waves, hpMul: 0.92 + idx * 0.14 };
  };

  // ---------------- upgrade rolling ----------------
  D.rollUpgrades = function (run, count, rarityFilter, exclude) {
    exclude = exclude || [];
    const counts = run.upgradeCounts || {};
    const pool = D.upgrades.filter((u) => {
      if (exclude.indexOf(u.id) >= 0) return false;
      if (rarityFilter && rarityFilter.indexOf(u.rarity) < 0) return false;
      if ((counts[u.id] || 0) >= (u.max || 1)) return false;
      return true;
    });
    const picks = [];
    const local = pool.slice();
    const bossBoost = run.roomIndex >= 4 ? 1.7 : 1;
    for (let i = 0; i < count && local.length; i++) {
      const weights = local.map((u) => {
        let w = D.rarity[u.rarity].weight;
        if (u.rarity === 'legend') w *= bossBoost;
        if (u.rarity === 'epic') w *= 1 + run.roomIndex * 0.08;
        return w + (exclude.indexOf(u.id) >= 0 ? 0 : 0.001);
      });
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let picked = local[local.length - 1];
      for (let j = 0; j < local.length; j++) {
        r -= weights[j];
        if (r <= 0) { picked = local[j]; break; }
      }
      picks.push(picked);
      local.splice(local.indexOf(picked), 1);
    }
    return picks;
  };

  D.rollRelics = function (run, count) {
    const owned = run.relics.map((r) => r.id);
    const pool = D.relics.filter((r) => owned.indexOf(r.id) < 0);
    const local = U.shuffle(pool).slice(0, count);
    return local;
  };

  // ---------------- door picks ----------------
  D.rollDoors = function (run) {
    const types = ['battle', 'elite', 'treasure', 'event', 'rest', 'shop'];
    const weights = {
      battle: 34,
      elite: run.roomIndex >= 1 ? 20 : 10,
      treasure: 14,
      event: 16,
      rest: 10,
      shop: 10,
    };
    if (run.lastDoor === 'shop') weights.shop = 2;
    if (run.lastDoor === 'rest') weights.rest = 2;
    const picked = [];
    const local = types.slice();
    for (let i = 0; i < 2 && local.length; i++) {
      const ws = local.map((t) => weights[t] || 1);
      const total = ws.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (let j = 0; j < local.length; j++) { r -= ws[j]; if (r <= 0) { idx = j; break; } }
      picked.push(local[idx]);
      local.splice(idx, 1);
    }
    return picked;
  };
})();
