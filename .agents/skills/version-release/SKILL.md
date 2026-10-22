---
name: xihan-flow-version-release
description: 为 XiHan.FlowDesigner 定版本、消费变更集、进出 rc 预发布、打 v* 标签、看 Release 发 npm 与部署文档站，或发完核对 dist-tags 时使用。只有用户明确要求发版时才推送、打标签或触发 Release。
---

# XiHan.FlowDesigner 版本发布

## 前置条件

- 工作区无冲突、没有进行中的 merge / rebase；在 `dev` 上做，detached HEAD 不发版。
- 三个公开包 `@xihan-flow/core`、`runtime`、`designer` 经 changesets 的 `fixed` 组锁步同版；版本真源是三包的 `version`，预发布状态在 `flow/.changeset/pre.json`。
- 标签写 `v<版本>`（如 `v1.0.0-rc.2`），必须打在 `main` 历史里的提交上，标签号等于三包版本、与 `pre.json` 的通道一致；`scripts/release/check-release-tag.mjs` 核对，Release 的 guard 也查这两条。
- 推送、打标签、发布都要用户当时明确同意；同意一次只管这一次。

## 准备版本

1. 核对上一个 `v*` 标签以来的变更集与实际改动是否对得上（`xihan-flow-changelog-collect`）。
2. 在 `flow/` 跑 `scripts/release/VersionUpgrade.bat`（或 `pwsh scripts/release/VersionUpgrade.ps1`），不替用户预选级别与通道；`-DryRun` 只打印计划。rc 怎么起号、怎么续号与转正见 [references/rc-numbering.md](references/rc-numbering.md)。
3. 核对：三包同版、各包 `CHANGELOG.md`、`pre.json`、被消费的变更集；在 `docs/changelog.md` 补这一版的一节（导航上的版本号自动取 core 的版本）。
4. 门禁全跑：`flow/` 的 `pnpm lint`、`build`、`typecheck`、`test`、`gate:publish`、`smoke --pack`，`docs/` 的 `gate:gen`、`check:examples`、`lint`、`typecheck`、`build`，`git diff --check`。
5. 提交 `build: v<版本>`；推 dev 等 CI 全绿；`git fetch . dev:main` 把 main 快进到 dev，推 main，等 CI 全绿。这一笔推送后不再 amend 或 rebase。

## 发布

用户明确要求后，在 main 的末笔上打标签并推送：`git tag v<版本> main`、`git push origin v<版本>`。Release 工作流依次是：核对标签 → 发到 npm（构建、`gate:publish`、`changeset publish` 带 provenance，凭 `NPM_TOKEN`）→ 预发布版跟上 `latest`（`scripts/release/promote-latest.mjs`：预发布模式、且 npm 上这个包还没有正式版时，等取得到这一版再 `npm dist-tag add <包>@<版本> latest`；有正式版后不动）→ 发布后冒烟（`smoke.mjs --version` 在空项目里装刚发的版本）→ 部署文档站（`deploy-docs.yml` 只部署已发布的版本）。

只看 `gh run view <run-id>` 的摘要。发完核对三个包都在；正式版发出前 `rc` 与 `latest` 都指向这一版，之后预发布只动 `rc`：

```bash
npm view @xihan-flow/core dist-tags
npm view @xihan-flow/runtime dist-tags
npm view @xihan-flow/designer dist-tags
```

冒烟报「npm 上找不到 …」、E404、ETARGET、No matching version 时，多半是 npm 还没同步完（新包首发时 npm 先挂一个 `0.0.0-stage` 占位版，真正的版本可能晚到十分钟）。等 `npm view @xihan-flow/<包>@<版本> version` 取得到，再 `gh run rerun <run-id> --failed` 补跑冒烟与部署。「预发布版跟上 latest」那一步失败（多半是 npm 还取不到这一版，它会等约 5 分钟）：重跑「发到 npm」这个 job，发包那步跳过已有的版本，接着补上 `latest`。不手工改 dist-tag，除非用户明确要。其他失败停下报原文。不删标签重打、不移动标签掩盖问题、不手改 dist、不重复发已存在的版本。
