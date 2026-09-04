# AGENTS.md

给在这个仓库里工作的编程助手看的说明。

## 约定

- 用户可见文案用中文；代码标识符、提交说明、协议字段用英文。
- 改协议先改 `packages/protocol`，再 `pnpm --filter @mowen/protocol build`，然后改 server / web。
- 工作模式是「项目 + 目标 + 执行记录」：对话是单点会话，工作目标有生命周期，结束后才能再追加。
- 改 UI 后尽量跑相关 e2e；CI 会跑 lint、typecheck、单测、集成测试，以及除 `visual workbench` 以外的 Playwright。

## 常用命令

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e --grep-invert "visual workbench"
```

## 发版

- 版本号写在各 `package.json`；服务端读取 `@mowen/server` 的 `package.json` 或 `MOWEN_VERSION`。
- 打 `vX.Y.Z` tag 会走 Release：macOS arm64、macOS x64、Windows x64，并生成 `SHA256SUMS.txt`。
- 没有 Apple 公证。macOS 用 `scripts/install-macos.sh`，不要让用户双击 DMG。
