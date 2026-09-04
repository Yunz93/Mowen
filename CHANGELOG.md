# Changelog

## Unreleased

- 终端 tab 改为 xterm.js，输入、滚动、选中复制和粘贴按原生终端来。
- 桌面版启动时检查更新，有新版本时在顶栏一键更新并重启。
- 去掉界面里多余的说明文字。
- 应用重启后，未完成的工作目标不再卡在「进行中」，会标成已暂停并允许继续。
- HTTP 接口拒绝非本机 Host 和外来 Origin，降低 DNS rebinding 风险。
- 桌面更新会校验 Release 里的 `SHA256SUMS.txt`。
- Release 同时打包 macOS arm64 与 Intel x64。
