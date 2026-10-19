# OVERTIME · 加班地狱

> 超能都市 · 办公室求生 —— 一款用 Canvas 2D + rough.js 手绘像素风制作的二次元肉鸽小品。

午夜 00:00，无限公司整栋大楼醒了。实习生**阿比盖尔**只想拿回自己的加班费，却被 HR 告知「本月工资以积分形式发放，积分不可兑换」。她上楼找老板，老板已经变成一台会打印周报的怪物，同事们变成了纸团、打印机和续命尸。

于是她决定：既然公司不讲劳动法，那就用办公用品讲。

本仓库保留可直接运行的原网页，并提供独立的小红书小工具 H5 版本。制作视频、生成的上传包、测试截图和阶段回退包不纳入源码仓库。

## 版本入口

| 版本 | 入口 |
|-|-|
| 原网页 | 根目录 `index.html` |
| 小红书小工具 H5 | [`xiaohongshu/package/index.html`](xiaohongshu/package/index.html) |

## 小红书小工具 H5

小红书版本完整放在 [`xiaohongshu/`](xiaohongshu/README.md)，可直接本地预览；不需要安装 Node.js 或构建依赖。手机支持虚拟摇杆、攻击/闪避/双技能/交互/暂停，竖屏会自动旋转舞台并校正触控方向。

在仓库根目录运行以下命令生成上传包：

```sh
python xiaohongshu/make_zip.py
```

输出 `xiaohongshu/neon-overtime-xhs-tool.zip`。**不要直接压缩整个 `xiaohongshu/` 目录上传**；上传包只包含 `package/` 内的运行文件，ZIP 根目录直接是 `index.html`。

H5 优先使用小红书端侧异步存档，进度与原网页分开。运行包中的字体、图标和图形库许可全文收在 `third-party-licenses.json`。

已完成 **11/11 项本地 H5 发布包检查**，包含严格 CSP、键鼠/触屏、横竖屏坐标、存档与挑战；这些测试使用模拟端接口。用户于 2026-10-19 确认此前上传成功，实体 Android/iOS 小红书容器仍待验收。

详细步骤见[小工具说明](xiaohongshu/README.md)，测试范围见[验证记录](xiaohongshu/VALIDATION.md)。

## 原网页直接开玩

1. 下载或克隆本仓库。
2. 双击 `index.html`。
3. 推荐使用最新版 Chrome 或 Edge；窗口越大，像素画面越清晰。

游戏不需要安装、构建或启动服务器。若浏览器限制 `file://` 下的 LocalStorage，可在仓库目录运行：

```powershell
python -m http.server 8000
```

然后访问 <http://127.0.0.1:8000/>。

## 操作

| 键鼠 | 触屏 | 动作 |
|-|-|-|
| `WASD` / 方向键 | 左侧虚拟摇杆 | 移动 |
| 鼠标 | 自动瞄准 | 瞄准 |
| 按住左键 | 按住「攻击」 | 远程开火 / 聚焦 |
| 逐次点击左键 | 逐次点击「攻击」 | 近战三连，第三击为重击 |
| `Space` | 「闪避」 | 闪避 |
| `Q` / `R` | 「技能」/「副技」 | 主技能 / 副技能 |
| `E` / `F` | 「交互」 | 进门、开宝箱、调查终端等 |
| `Esc` | 右上「II」 | 暂停 / 继续 |
| `Tab` | — | 查看当前构筑 |
| `1` / `2` / `3` | 点击卡片 | 选择升级、遗物或事件选项 |
| `M` | — | 静音 |

## 内容

- 两名可用员工：远程狙击型**阿比盖尔**、近战召唤型**阿码**
- 四把武器、24 项通用升级、10 张技能卡、10 件遗物
- 六个普通房间与三阶段天台 Boss **KPI-0**
- 普通模式，以及 KPI 冲刺、铁人合同、Boss 连审三种挑战
- 可破坏办公室家具、服务器与复印机连锁爆炸
- 清房后的终端调查、路线风险提示与三选一奖励
- 剧情、员工档案、图鉴、局外培训、独立挑战纪录与触屏操作

## 原网页技术栈

- 纯 HTML + CSS + 经典 `<script>`，可直接通过 `file://` 运行
- Canvas 2D 固定 960×540 世界坐标，120Hz 固定步长逻辑更新
- rough.js 手绘线条、canvas-confetti 胜利彩纸
- WebAudio 实时合成战斗音效与音乐
- LocalStorage 保存设置、纪录、培训与图鉴进度

## 第三方资产

- **Fusion Pixel Font**：SIL Open Font License 1.1，许可证位于 `assets/fonts/`
- **Pxlkit**：像素图标，Pxlkit Asset License；图标署名 `Pxlkit / https://pxlkit.xyz`，许可证位于 `assets/ui/pxlkit/`
- **Kenney UI Audio**：CC0 1.0，许可证位于 `assets/audio/kenney/`
- **canvas-confetti**：ISC，许可证位于 `js/libs/`
- **rough.js**：MIT，许可证位于 `js/libs/`

角色立绘、像素角色和游戏内 UI 为本项目素材；游戏运行所需文件均随仓库提供。
