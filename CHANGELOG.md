# Changelog

## Unreleased

- 应用重启后，未完成的工作目标不再卡在「Agent 工作中」，会标成已暂停并允许继续。
- HTTP 接口拒绝非本机 Host 和外来 Origin，降低 DNS rebinding 风险。
- 桌面更新会校验 Release 里的 `SHA256SUMS.txt`。
- Release 同时打包 macOS arm64 与 Intel x64。
