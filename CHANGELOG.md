# Changelog

## Unreleased

## 0.1.9

- 产品名改为轻舟 / Qingzhou。旧的 `MOWEN_*` 环境变量和 `~/.mowen` 数据目录仍可用。
- 应用图标改为暗底折纸小船，不再用 π。
- Release 不再等待 GitHub `macos-13` Intel 排队，先发 Apple 芯片和 Windows。
- API 请求失败时在界面展示服务商返回的原因，不再变成空白或 `[object Object]`。
- OpenAI 订阅登录换 token 会走 `HTTPS_PROXY` / 系统代理，避免浏览器过了、轻舟进程不过。

## 0.1.8

- 终端 tab 改为 xterm.js，输入、滚动、选中复制和粘贴按原生终端来。
- 桌面版启动时检查更新，有新版本时在顶栏一键更新并重启。
- 去掉界面里多余的说明文字。
- 对话、审批、看板和检查器的交互收紧（发送/停止合一、工具折叠、审批倒计时等）。
- 应用重启后，未完成的工作目标不再卡在「进行中」，会标成已暂停并允许继续。
- HTTP 接口拒绝非本机 Host 和外来 Origin，降低 DNS rebinding 风险。
- 桌面更新会校验 Release 里的 `SHA256SUMS.txt`。
- Release 同时打包 macOS arm64 与 Intel x64。
- 修复桌面版重复注册 `qingzhou:pick-folder` 导致启动失败。
- 修复桌面版启动时再拉起一个带独立图标的 Electron 进程。
