# 加班地狱 · 小红书小工具 H5

此目录只维护小红书 H5 版本，不改变仓库根目录的游戏。`package/` 是可独立运行和打包的完整小工具：HTML、CSS、三个经典脚本及全部本地素材。

该版本沿用已上传成功的 H5 运行内容，并补全包内许可 JSON；玩法、界面与运行脚本均未改动。用户于 2026-10-19 确认此前的小工具上传成功。

## 本地预览

打开 `package/index.html` 即可，无需安装 Node.js、构建依赖或启动服务器。普通浏览器没有小红书 SDK 时会使用浏览器缓存兼容，并显示提示。

## 生成上传包

在仓库根目录运行：

```sh
python xiaohongshu/make_zip.py
```

输出 `xiaohongshu/neon-overtime-xhs-tool.zip`。ZIP 根目录直接包含唯一的 `index.html`，仅收录平台允许的文件类型。**不要把整个 `xiaohongshu/` 目录直接压缩上传**，其中的说明和测试脚本不属于运行包。

后续更新到创作后台 Builder hub → 小工具上传。上传前仍应按当时页面提供的完整口令核对规范，再做平台内预览和 Android/iOS 小红书真机检查。

## 手机操作

左侧虚拟摇杆移动；右侧提供攻击、闪避、双技能、交互与暂停。激光长按发射，松手散热，过热时停束。竖屏自动旋转舞台并校正触控坐标，方向变化会清输入并暂停。普通模式及三种挑战均保留。

## 存档与资源

支持的客户端优先使用 `window.xhs.miniTool` 异步存档；先读档再启动、串行写入、失败提示与重试。H5 key 为 `neon_overtime_minitool_v1`，与原网页存档分开。无 SDK 的浏览器缓存不保证清理后恢复。

运行包不联网，不含内联脚本、外链跳转、全屏调用、后台线程库或 OGG 加载。音效与音乐使用 WebAudio，许可全文保存在 `package/third-party-licenses.json`，可见 Pxlkit 署名保留。

## 可复现检查

打包后可选择安装测试依赖，运行独立的发布包检查：

```sh
python -m pip install -r xiaohongshu/requirements-test.txt
python -m playwright install chromium
python xiaohongshu/verify.py
```

检查使用本地模拟端接口和严格 CSP，不会登录或操作小红书账号。详细范围见 [VALIDATION.md](VALIDATION.md)。生成的 ZIP、截图、缓存和测试 JSON 不提交到仓库。
