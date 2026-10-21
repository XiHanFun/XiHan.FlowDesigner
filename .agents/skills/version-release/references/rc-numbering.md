# rc 预发布的起号、续号与转正

changesets 的预发布号 `-rc.N` 不记在 `pre.json` 里，按包**当前的** `version` 推：当前版本没有预发布后缀时 N=0，是 `x.y.z-rc.k` 时 N=k+1；基线也取当前版本，再按变更集里最高的级别升。所以从一个正式版（或首发前的 0.0.0）直接进 rc，只会出 `-rc.0`。

## 续号：rc.N → rc.N+1

已在 rc 预发布里（`pre.json` 的 `mode` 是 `pre`）时，写好变更集后：

```bash
pwsh scripts/release/VersionUpgrade.ps1 -Channel keep -Level derived
```

## 转正：rc.N → 正式版

```bash
pwsh scripts/release/VersionUpgrade.ps1 -Channel release -Level derived
```

脚本执行 `changeset pre exit`，出 `x.y.z`；`pre.json` 与预发布期间记在里面的变更集（如首发的 `first-release.md`）这时才删。

## 从正式版进 rc，并且要从 rc.1 起号

首发 `1.0.0-rc.1` 就是这样落的。在 `flow/` 下，先把这一版的其他改动（README、更新日志页等）改好，再：

1. `pnpm exec changeset pre enter rc`：建 `pre.json`，`initialVersions` 记下真实的当前版本。**必须在第 2 步之前**，否则 `initialVersions` 记成临时号。
2. 三个公开包的 `package.json` 把 `version` 临时改成 `<目标>-rc.0`（只改这一行，playground 不动），表示 rc.0 这个号已经用掉。
3. `pwsh scripts/release/VersionUpgrade.ps1 -Channel keep -Level derived -Yes`：推出 `<目标>-rc.0 -> <目标>-rc.1`，跑 `changeset version`。

跑完核对：三包都是 `<目标>-rc.1`，包之间的 `workspace:^` 不变；`pre.json` 的 `mode: pre`、`tag: rc`、`initialVersions` 是真实的旧版本；各包 CHANGELOG 的第一节是 `<目标>-rc.1`；`RELEASE_TAG=v<目标>-rc.1 node scripts/release/check-release-tag.mjs` 通过，`-rc.0` 与正式号被拒。临时写的 rc.0 不留痕迹。
