# awesome-dsh-plugin 插件投稿步骤

> 记录 2026-08-22 向 [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 投稿 dsh 插件的完整可复现流程。
> 本次实际投稿：`dsh-session-search-toggle`（PR #2658）与 `dsh-thinking-levels`（PR #2660），均已通过 CI。

---

## 0. 前置条件

- 本机已登录 GitHub CLI（`gh auth status`，token 带 `repo` scope，Git operations 协议用 **https**）。
- 本机 GitHub 走代理：`http://127.0.0.1:30987`（用 SSH 时 publickey 失败，**必须用 https remote + 代理**）。
- 本地已 clone **fork**：`git clone https://github.com/<you>/awesome-dsh-plugin.git`，并已添加上游：
  ```sh
  git remote add upstream https://github.com/awesome-dsh-plugin/awesome-dsh-plugin.git
  ```

## 1. 准备插件条目 YAML

在 `data/plugins/` 新建 `<owner>__<repo>.yml`：

```yaml
url: https://github.com/<owner>/<repo>
name: <owner>/<repo>
category: <cat>        # 见下方分类对照
description:
  en: '...'            # 含 ": " 时必须用单引号包裹，否则 YAML 解析失败
  zh: ...
```

分类 `CAT_IDS`（`scripts/lib/entries.mjs`）：

```
ui | usage | theme | model | identity | session | memory | tools | browser |
vision | voice | docs | skill | workflow | git | notify | dev | security |
remote | market | fun
```

常用对照：会话类 → `session`；LLM/推理 → `model`（README 显示为 "Models & Providers"）。

## 2. 重建干净分支（关键！fork main 必须与上游同步）

> 踩坑记录：fork 的 main 若与上游 diverged，直接建 PR 会带上几百上千个 commit。
> 本次 fork main 曾 ahead 1443 / behind 2154，首次 PR #1 因此是错的（建在 fork 内部 + 1444 commits）。

```sh
git fetch upstream main
git checkout -b add/<repo> upstream/main     # 基于上游最新 main 建分支
```

## 3. 重新生成 README（CI 强制）

CI 用 `node scripts/generate-readme.mjs --check` 校验 README 与 `data/plugins/` 同步，**必须**重跑：

```sh
npm ci                              # 装 devDependencies（js-yaml / marked）
node scripts/generate-readme.mjs    # 写模式：重新生成 README.md + README.zh.md
node scripts/generate-readme.mjs --check   # 校验，输出 "up to date" 即通过
```

验证条目落对分类：`grep -n '<repo>' README.md`，对照 `^### ` 标题确认区块。

## 4. 提交 + 推送 fork

```sh
git add data/plugins/<owner>__<repo>.yml README.md README.zh.md
git commit -m "add <owner>/<repo> (<cat>)"
git push -u origin add/<repo>       # 走代理：$env:HTTPS_PROXY/HTTP_PROXY
```

## 5. 创建跨仓库 PR（建到上游）

> **每个 PR 最多 3 条。** 超量 CI 拒绝。多个插件是自己的话，挑质量最好的提交。

```sh
gh pr create --repo awesome-dsh-plugin/awesome-dsh-plugin \
  --head "<you>:add/<repo>" --base main \
  --title "add <owner>/<repo> (<cat>)" \
  --body-file pr-body.md
```

PR body 参考：

```markdown
Add [<owner>/<repo>](url) to the **<分类名>** category.

- url: <url>
- category: `<cat>`
- description.en + description.zh included
- READMEs regenerated (N entries)
- Repo declares `dsh.bundle` manifest, published on npm as `<npm-name>`
- `@deepseek-ai/*` packages declared as optional peerDependencies
- `dsh-plugin` topic added to repo
```

## 6. 验证

```sh
gh pr view <num> --repo awesome-dsh-plugin/awesome-dsh-plugin \
  --json mergeable,mergeStateStatus,commits,changedFiles,additions,deletions
# 期望：MERGEABLE / CLEAN / 1 commit / 3 files / +N -0

gh pr checks <num> --repo awesome-dsh-plugin/awesome-dsh-plugin
# 期望：check pass + Submission gate pass（awesome-lint 在跨仓库上下文跑，读上游 topics 才通过）
```

> 教训：`awesome-lint` 的 `awesome-github` 规则读**当前 git remote 仓库**的 topics。
> 上游已有 `awesome` + `awesome-list` topics；fork topics 为空 → 在 fork 里跑 CI 必挂
> （`should have "awesome" as a GitHub topic`）。所以 PR 必须建到上游仓库（跨仓库 PR）。

## 7. 收尾

- 关闭误建的 fork 内部 PR（`gh pr close <num> --repo <you>/awesome-dsh-plugin`）。
- 清理临时文件（pr-body.md）、本地多余分支。

---

## 附加：npm 包 README 安装说明（input-traffic 风格）

投稿后记得让仓库与 npm 包的 README 包含 **npm 安装说明**（参考 `dsh-input-traffic` 风格）。

```sh
# 方式一：从 npm 安装（推荐）
#   （profile 是 pnpm workspace root，add 需带 -w 参数）
dsh plugin --profile web add <npm-name> -w

# 方式二：git 或本地路径组装
# dsh plugin --profile web add github:<owner>/<repo>#<tag> -w
#    （git 安装后需在 profile 的 node_modules 内现场构建：npm install --legacy-peer-deps && npm run build）

# 确认组合树包含新行
dsh web --dump-config | grep -B1 -A2 '<repo>'

# 重启 dsh web —— 必做！运行中实例不热载 bundle 层
dsh web
```

发布 npm（README 跟随发布）：

```sh
npm whoami                 # 确认登录
npm version patch --no-git-tag-version
npm publish --dry-run      # 预览
npm publish                # 正式发布（走代理）
git add package.json && git commit -m "chore: bump to x.y.z" && git push
npm view <npm-name> version readme   # 验证 README 已更新
```

> 踩坑记录：dsh-session-search-toggle 曾以 `dsh-switch-search` 为 GitHub remote（SSH），
> SSH publickey 不通；改 `git remote set-url origin https://...` 后经代理正常推送。

## B.1 投稿前仓库自查清单（contributing.md 强制要求）

| 条目 | 说明 | 检查命令 |
|------|------|----------|
| `dsh.bundle` manifest | `package.json` 必须声明 `dsh.bundle`（仅 `dsh.client` 会被 CI 拒绝） | 见下方 §B.2 |
| `@deepseek-ai/*` peerDeps | 必须 `peerDependencies`（非 `dependencies`），推荐 `optional` 标记避免宿主版本硬约束 | 见下方 §B.3 |
| `dsh-plugin` topic | 仓库必须添加此 topic，否则 CI 不通过 | `gh api repos/<owner>/<repo>/topics | ConvertFrom-Json | names` |
| 仓库年龄 ≥ 1 天 | CI 自动检查，新仓会被拒绝 | `git log --format=%ai -1` |
| 真实可运行代码 | 占位仓 / 纯 README 仓不收 | — |
| 描述与代码一致 | 夸大理是主要拒稿原因（写了 "46 个工具" 就必须真有 46 个） | 人工核对 |
| 每个 PR ≤ 3 条 | 超量 CI 拒绝，需拆分 | — |

## B.2 `dsh.bundle` manifest 完整示例

> 常见拒稿原因：只声明了 `dsh.client`。这还不够，`dsh.bundle` 是必需的。

```jsonc
{
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web" }     // 仅带前端 UI 时需要
  }
}
```

旁边必须放 `cordis.patch.yml`：

```yaml
- insert:
    - id: your-plugin-id
      name: your-package-name
```

## B.3 `@deepseek-ai/*` peerDependencies — 版本支持声明（关键！）

> 来源：[awesome-dsh-plugin/contributing.md — @deepseek-ai/* packages as peerDependencies](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md#how-submissions-are-reviewed--%E6%94%B6%E5%BD%95%E5%A6%82%E4%BD%95%E8%AF%84%E5%AE%A1)
> 参照实战：[drscrewdriver/dsh-input-traffic](https://github.com/drscrewdriver/dsh-input-traffic)（通过审核的 cordis bundle 插件）

**必须**把 `@deepseek-ai/*` 官方包声明为 `peerDependencies`（不是 `dependencies`）。

### 版本适配机制

DSH 插件的宿主版本兼容性**不由 peerDependencies 控制**，而是由插件使用的 cordis API 稳定性决定。peerDependencies 的真正用途是：

1. **开发期类型检查**（TypeScript / IDE 解析）
2. **npm 安装时提示版本不匹配**（仅当 `optional` 标记关闭时才会报错）

### 两种写法

**写法 A — `optional: true`（主流，如 dsh-input-traffic）**
所有 `@deepseek-ai/*` 标为 optional，用户装在任何 DSH 版本都不会因 peer 解析失败。`^x.y.z-rc.N` 范围足以。

```jsonc
"peerDependencies": {
  "@deepseek-ai/cordis": "^4.0.1",
  "@deepseek-ai/dsh-client-locale": "^0.1.0-rc.5",
  "@deepseek-ai/dsh-client-runtime": "^0.1.0-rc.5",
  "@deepseek-ai/dsh-client-ui-conversation": "^0.1.0-rc.5"
},
"peerDependenciesMeta": {
  "@deepseek-ai/cordis":          { "optional": true },
  "@deepseek-ai/dsh-client-locale": { "optional": true },
  "@deepseek-ai/dsh-client-runtime": { "optional": true },
  "@deepseek-ai/dsh-client-ui-conversation": { "optional": true }
}
```

**写法 B — 非 optional（需要强制版本匹配时使用）**
contributing.md 的 prerelease 建议**仅在非 optional 时生效**。`^0.1.0-rc.5` 展开为 `>=0.1.0-rc.5 <0.2.0`，不含 prerelease 标签的稳定版本（如 `0.1.0`）会被静默排除。

```jsonc
// ❌ 稳定版 0.1.0 无法匹配（ERESOLVE）
"peerDependencies": { "@deepseek-ai/dsh-tools": "^0.1.0-rc.5" }

// ✅ 用 || 分支覆盖 stable + prerelease
"peerDependencies": {
  "@deepseek-ai/dsh-tools": ">=0.0.1-rc.1 <0.1.0 || >=0.1.0-rc.1 <0.2.0-0"
}
```

> **趋势**：实际被收录的 cordis bundle 插件（如 `dsh-input-traffic`）全部采用 optional 写法，不强制版本约束。你的插件用哪种取决于你是否需要保证用户宿主版本一致——大多数情况下不需要。

### 版本范围速查

| 范围写法 | 匹配示例 | 稳定版匹配 | 说明 |
|---------|---------|-----------|------|
| `^0.1.0-rc.5` | `0.1.0-rc.5` ~ `0.1.9-rc.x` | ❌ | caret + prerelease，stable 被排除 |
| `>=0.0.1 <0.2.0` | `0.0.1` ~ `0.1.999` | ✅ | 无 prerelease 标签，stable 和 rc 都行 |
| `>=0.0.1-rc.1 <0.1.0 \|\| >=0.1.0-rc.1 <0.2.0` | 所有 rc | ✅ | 显式分支，最安全 |
| `~0.1.0` | `0.1.0` ~ `0.1.999` | ✅ | patch-level 兼容 |

## B.4 不发 npm 时的 tarball 方案

如果不发布到 npm，可以把预构建 tarball 附加到 GitHub Release，在条目 YAML 中用 `tarball:` 字段指向它：

```yaml
tarball: https://github.com/owner/repo/releases/latest/download/your-plugin.tgz
```

规则：
- 必须是 GitHub Release 托管的 `https` `.tgz`
- `latest/download/` 只在请求时解析 `latest`，**文件名照字面取**
  - 如果资产名带版本号，`latest/download/plugin-1.0.0.tgz` 在下一次发版后 404
  - 要么资产名不带版本（如上方），要么钉住 release tag：

```yaml
# 钉住 tag —— 不会腐烂，文件名带版本也没关系
tarball: https://github.com/owner/repo/releases/download/v1.2.0/your-plugin-1.2.0.tgz
```

## B.5 多版本插件投稿（DSH 大版本不兼容时）

> 来源：`dsh-session-search-toggle` 实战——DSH 0.1.2 移除了 `dsh-client-runtime`，
> 插件客户端 bundle 需要导入不同包名，无法用单一版本同时兼容。

### 问题场景

DSH 在 0.1.2-alpha.2 做了客户端包重构：

| DSH 版本 | 可用包 | 已废弃 |
|---|---|---|
| ≤ 0.1.1-rc.2 | `dsh-client-runtime` | — |
| ≥ 0.1.2-rc.1 | `dsh-client-store` | `dsh-client-runtime` |

**结果**：插件的 `import defineStore` 在不同 DSH 版本中需要指向不同包名，单一 npm 版本无法同时兼容。

### 解决方案：同名多版本

**同一 npm 包名**，通过 semver 版本区分兼容范围：

```
npm 包名：dsh-session-search-toggle
├── 0.1.0  →  DSH ≤ 0.1.1  (dsh-client-runtime)
└── 0.1.1  →  DSH ≥ 0.1.2  (dsh-client-store)
```

用户通过 `dsh plugin add <pkg>@<version>` 选择版本。

### 操作步骤

#### 1. 锁定旧版（关键！先打 tag 再改代码）

```sh
# 在旧版代码上 commit + tag
git tag -a v0.1.0 -m "v0.1.0: DSH ≤ 0.1.1"
git push origin v0.1.0

# ⚠️ npm 版本不可变——已发布的 0.1.0 无法覆盖
# 如果还没发布，先 npm publish --access public
```

#### 2. 叠加新版修改

```sh
# 修改 src/client/index.ts 的 import
# 旧：import { defineStore } from '@deepseek-ai/dsh-client-runtime/client'
# 新：import { defineStore } from '@deepseek-ai/dsh-client-store'

# 修改 package.json
# - version: 0.1.1
# - peerDependencies: dsh-client-runtime → dsh-client-store
# - dsh.client.inject: 移除 dsh-client-runtime

# 修改 dsh.plugin.json
# - version: 0.1.1
# - engines.dsh: >=0.1.2-rc.1

# 修改 tsdown.config.ts
# - externals: 替换为 dsh-client-store，删除死外部依赖
```

#### 3. commit + tag 新版

```sh
git add -A
git commit -m "v0.1.1: 迁移到 dsh-client-store，支持 DSH 0.1.2+"
git tag -a v0.1.1 -m "v0.1.1: DSH ≥ 0.1.2"
git push origin v0.1.1
```

#### 4. 发布新版 npm

```sh
npm publish --access public
npm view dsh-session-search-toggle versions
# 应显示: ["0.1.0", "0.1.1"]
```

#### 5. 更新 awesome-dsh-plugin 条目

在 `data/plugins/<owner>__<repo>.yml` 中添加版本说明：

```yaml
url: https://github.com/<owner>/<repo>
name: <owner>/<repo>
category: session
description:
  en: 'DSH web sidebar session search: title/content toggle with type filters'
  zh: 'DSH web 侧边栏会话搜索增强：标题/内容一键切换，按用户/回复/工具筛选'
notes: |
  **版本兼容**：
  - 0.1.0 → DSH ≤ 0.1.1（`dsh plugin add dsh-session-search-toggle@0.1.0`）
  - 0.1.1 → DSH ≥ 0.1.2（`dsh plugin add dsh-session-search-toggle@0.1.1`）
```

### 版本锁定机制

每个版本通过两处元数据声明兼容范围：

| 元数据位置 | 字段 | 作用 |
|---|---|---|
| `package.json → peerDependencies` | `dsh-client-store >=0.1.2-rc.1` | npm 安装时版本校验 |
| `dsh.plugin.json → engines.dsh` | `>=0.1.2-rc.1` | DSH 运行时版本校验 |

### 验证清单

- [ ] v0.1.0 tag 存在，package.json 版本正确
- [ ] v0.1.1 tag 存在，package.json 版本正确
- [ ] 0.1.1 的 `engines.dsh` 声明为 `>=0.1.2-rc.1`
- [ ] 0.1.1 的 peerDependencies 使用新包名
- [ ] 0.1.1 的 dsh.client.inject 不包含旧包名
- [ ] README 顶部版本兼容矩阵已更新
- [ ] awesome-dsh-plugin 条目包含版本矩阵
- [ ] npm publish 成功（`npm view` 验证）
- [ ] 在旧版 DSH 上测试 0.1.0 安装成功
- [ ] 在新版 DSH 上测试 0.1.1 安装成功

---

## B.6 npm 包与仓库关联（非必须但推荐）

- 已发布包的 `repository` 字段**必须**指回 awesome-dsh-plugin 列表中的仓库，否则两者不关联
- 映射从 registry 自动采集，条目 YAML 里手写 `npm:` 会被拒绝
- 没有 npm 包也一样：条目照常工作，只是没有下载量数据

---

# 附录 A：目录卡片截图 / 图片投稿指南（screenshots）

> 依据 `BananaSoldier01/dsh-tidychat` 的落地方式 + 目录仓库 `scripts/build-site.mjs` /
> `scripts/probe-screenshots.mjs` / `scripts/prune-legacy-screenshots.mjs` 的规则整理，
> 供给目录条目加卡片截图时参考。图片放在「插件自己仓库」优于「目录仓库」，后者只是兼容旧条目。

## A.1 两条硬规则（build-site / probe-screenshots 强制）

1. **key 必须与 README 条目链接完全一致**，否则 build 报
   `"<url>" is not a listed entry URL (keys must match the README entry link exactly)`。
   - 例：README 链接是 `https://github.com/BananaSoldier01/dsh-tidychat`，
     则 screenshots 的 key 必须是这同一个 URL；多一个 `/dshmobile-plugin` 尾巴都不行（dshmobile 因此 CI 红）。
2. **每条目最多 8 张**（`MAX_SHOTS=8`）；图片必须 HTTPS 且托管在 GitHub：
   `raw.githubusercontent.com / user-images.githubusercontent.com / camo.githubusercontent.com / github.com`。
   非法 host 或超数量会被拒绝（数多为「死链」也会被 `probe-screenshots` 标出并剔除）。

## A.2 两种声明方式（优先装上面那种）

### 方式一：插件自己仓库声明（推荐，新机制，可覆盖目录侧）
在插件仓库**根目录**（包目录，`screenshots.json` 放 `package.json` 旁）放一个文件，合法形态任选其一：
```jsonc
// 1) 纯路径数组
["assets/navigator.png", "assets/settings.png"]
// 2) {"screenshots": [...]}
{ "screenshots": ["assets/navigator.png"] }
// 3) 单 key map：key = 条目 URL
{ "https://github.com/<owner>/<repo>": ["assets/navigator.png"] }
```
`probe-screenshots.mjs` 从 `https://raw.githubusercontent.com/<repo>/HEAD/<sub>/screenshots.json`
读取并校验存活；**有效则覆盖**目录侧的 legacy 条目。此时图片用相对路径，会解析成 raw 绝对链接。

### 方式二：目录仓库 centralized（legacy，仅旧条目/不声明者）
在 `awesome-dsh-plugin/data/screenshots.json` 加一条（`key = README 链接`，值是 raw 绝对数组）：
```json
"https://github.com/BananaSoldier01/dsh-tidychat": [
  "https://raw.githubusercontent.com/BananaSoldier01/dsh-tidychat/main/assets/navigator.png"
]
```
一旦作者走方式一，`prune-legacy-screenshots.mjs` 会把这条移除。

## A.3 落地步骤（以本插件为例）

```sh
# 1) 把真图放进插件仓库 assets/（当前只有 .gitkeep 占位，需放真实截图）
#    e.g. assets/chat-vision.png  assets/settings-capability.png
# 2) 在插件仓库根提交 screenshots.json（方式一，推荐）
#    ["assets/chat-vision.png", "assets/settings-capability.png"]
# 3) 推送插件仓库 main
# 4) 目录侧无需改 data/screenshots.json（方式一自动读插件仓库）
# 5) 重新生成并校验 README：node scripts/generate-readme.mjs --check
# 6) 提交/推送目录分支，PR CI 会跑 probe-screenshots 校验图片存活
```

## A.4 现状与待办（dsh-llm-openai-completions）

- 目前 `assets/` 只有 `.gitkeep`（无真实截图），目录条目也**未关联任何图片**。
- 待做：放 2–3 张说明截图到 `assets/`，按 A.3 方式一提交 `screenshots.json`，让投稿卡片带图。
- 注意：`package.json` 的 npm `files` 列表不含 `screenshots.json`，但目录探测读的是 git 仓库的
  `raw.githubusercontent.com/<repo>/HEAD/screenshots.json`，与 npm 发布无关，无需把它加进 files。
