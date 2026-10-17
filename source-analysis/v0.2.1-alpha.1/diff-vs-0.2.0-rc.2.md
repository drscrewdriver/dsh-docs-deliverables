# dsh-v0.2.0-rc.2 → dsh-v0.2.1-alpha.1 逐主题 diff 证据

> 区间：`639ed01539` → `5badb15009`，266 commits（201 非 merge + 65 merge），4190 files changed, +51032/−32761。
> 本文件按变更族给出提交号与关键证据；结论版见 [README.md](README.md)，插件视角见 [plugin-migration-guide.md](plugin-migration-guide.md)。

## 一、Schedule 换挂载制（bundle 退役 → Web 组合 + preset 贡献）

主线提交链（时间序）：

```
6c1a590a4c feat(schedule): contribute the reminder tools from a preset-scoped package
62aa32c6fe fix(schedule): complete the runtime closure and regenerate the graphs
96c421d985 fix(schedule): refuse reminders for sessions subagent routing owns
59c8bbbd6d fix(web): name the subagent-session refusal in the schedule editor
656adfc986 feat(web): mount time-context from the presets that use it
a3a4c3b9ce test(web): take the reminder tools from the preset in the Schedule Web spec
c75bd5a514 fix(web): keep the preset reminder rows disabled with the Host stopgap
f6bb7aa892 fix(tool-schedule): match the release train version
c6dd905972 feat(web): ship the Schedule service and task page in the Web composition
ce9bb458bb test(web): expect the reminder tools in the standard preset
574bb7e7da test(web): refresh the recorded Web sessions for the preset clock
f04f5f2959 fix(web): restore the version row in the no-browser settings golden
699f1a8dc1 feat(schedule): deny the reminder tools to delegated children
1b1b09e1fb fix(schedule): enforce the caller restriction in the tool layer
500295b2bd fix(schedule): return the subagent refusal through the update result
8c23bab422 docs(schedule): regenerate the Cordis catalog for the update refusal
a0b3f536fe test(ui-schedule): mirror the error-shaped refusal the service returns
08125dd330 test(schedule): assert the exact refusal instead of an unsafe matcher
9633724b40 fix(app-boot): drop the retired schedule bundle from profile manifests
```

关键证据：

```bash
# preset 声明 time-context + tool-schedule，subagent 行 toolFilter.deny 四工具
git diff dsh-v0.2.0-rc.2..dsh-v0.2.1-alpha.1 -- packages/bundle/web-app/presets/standard.patch.yml
# web-app bundle 新依赖 dsh-schedule + dsh-client-ui-schedule
git diff dsh-v0.2.0-rc.2..dsh-v0.2.1-alpha.1 -- packages/bundle/web-app/package.json
# 官方指南：加载 profile 自动摘 bundle、重写 package.json、time-context 顶层 override 失效
git show dsh-v0.2.1-alpha.1:docs/upgrade-guide/v0.2.0-rc.2/schedule-bundle-retired/guide.md
```

配套：`9706f3e5f3` 子代理-Session 映射覆盖测试、`2ca5f648c3`/`d8f38c4ad6`/`5586cfef7e`/`7d88fc9b2b` ui-schedule 细节。

## 二、Claude Code mods 桥（新能力族）

```
35873604ad feat(experimental): add Claude Code mods bridge
f1715c67ec refactor(experimental): make mods DSH plugins and drop the persistence change
57126d8baf feat(experimental): draw the mods' AbovePrompt band and expose it over a Remote
0b87f74cd3 feat(experimental): Web band for Claude Code mods
2db0c83e86 docs(experimental): compatibility page, READMEs, and catalogs for mods as plugins
600034d653 fix(experimental): harden the mods bridge after review
233032b8f4 fix(experimental): close the mods bridge review findings
54fa38795f fix(experimental): drop unknown casts from the mods bridge and its tests
77fcdf46d2 fix(experimental): hairline band borders and one engine-event list
7794021892 docs: regenerate the config catalog for the mods bridge source line
77fcdf46d2 / f87c957624 / 536bb5840f / a161070a76 / 34f52880b0   # 测试套件与快照
ca83aecbc8 / 6e948732d1 / 7555272e97                              # 平台稳定化与预算
```

接口面速记：`defineMod({ name, version, root, register })` → Cordis 插件；Config 缺省 `hookTimeoutMs: 10000` / `catchTimeoutMs: 1000` / `processTimeoutMs: 30000` / `bandColumns: 120` / `bandRows: 10` + `toolAliases`。hooks 事件：`session.start` / `prompt.submit` / `turn.start` / `tool.call` / `turn.complete` / `command.run` / `ui.render` / `session.end` / `<namespace>.<method>`。完整差异页：`docs/subsystems/claude-code-mods.md`。

## 三、运行时解析刷新 + HMR 包配置过期

设计记录：`.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.md`（含职责表、发布点位表、Node 内部接口替换表、Future Work）。

```
869afc493d fix(plugin-manager): refresh runtime package resolution
abf8b760ec fix(plugin-manager): preserve live runtime resolution mappings
99fce8d4ea docs(plugin-manager): clarify runtime resolution publication rules
6fe4a2e184 fix(hmr): invalidate changed package manifests        # 新 packages/boot/hmr/src/package-manifest.ts
d7d2e5fd4e fix(hmr): refresh CommonJS requests without evicting modules
69f555f06a docs(hmr): clarify CommonJS request refresh
b1c5f861b6 fix(hmr): preserve loaded entry identities across manifest changes
a59beb8ae3 fix(hmr): preserve manifest refresh with Office resolution
980b410340 fix(hmr): preserve native manifest behavior
4eb53e63ff fix(ci): cover HMR edge cases and document strict assertions
93b469a5e1 fix(webworker): support strict truthiness assertions
1273855237 test(hmr): cover runtime removal during dependency traversal
```

HMR 接口替换（`package-manifest.ts` 封装）：`readPackageJSON` / `getPackageScopeConfig` / `getPackageType` 绑定、`getNearestParentPackageJSON` 缓存旁路、ESM `ResolveCache` 原型替换一次后清空、CJS `Module._pathCache` 清空、`Module._load` 默认解析请求按新文件名加载。

## 四、runtime invariants 全家删除

```
f028f25667 refactor: remove runtime invariant plugins
f1f0dc54ff docs: drop remaining references to removed invariant checks
963715344b test: cover paths previously exercised only by invariant companions
```

证据：包删除 `packages/runtime-diagnostics/invariants`（diff-filter=D）；sdk-minimal profile 摘 5 行；四发射器改为包容监听失败。官方指南：`docs/upgrade-guide/v0.2.0-rc.2/remove-runtime-invariants/guide.md`。

## 五、显示资源契约收敛（subpath icon 规则等）

```
8339f16c1d fix(plugins): read package.json only for package-root plugins
d9a40155c1 docs(upgrade): subpath plugins use <subpath>/icon instead of package.json
ecedbbc2e6 fix(plugins): reuse locale metadata and export bundle icons
f30aec98b6 fix(plugins): reserve package display resources for bundles
d12257c959 fix(plugins): preserve manifest icon precedence
f8a274b76e fix(plugins): name declaring manifests and reject built display manifests
6d1e12b237 fix(plugins): keep credentials and shadowed copies out of bundle sources
9b79f97010 fix(plugins): keep aliases and whole user information in bundle sources
310c5ae151 docs(skills): require plugin display metadata and icons
176e961c33 fix(skills): validate exported resources in nested templates
71fd3cf2b5 test(skills): cover icon precedence and native diagnostic paths
2f7ed5fced test(skills): leave template resource validation to the package-meta gate
```

类型面唯一变化（`packages/util/package-manifest/src/types.ts`）是 `PluginLocalizedMeta.icon` 的**注释**更新：`Base64 image data URL from a package root's manifest icon or an exported `<specifier>/icon`"`——接口形状未变。

## 六、Session 检查器族

```
38c45638a2 feat(session-inspector): add raw-log and grouped-chat diagnostics
732dd913cf feat(inspector): embed Chrome DevTools and bundle optional diagnostics
ad22e6c80f build(inspector): compile DevTools from pinned npm sources
dcdf631ca2 feat(session-inspector): expand raw JSON details by default
9ec1a7ded9 test(inspector): align frontend smoke with the source build
29ca976eaf test(web): keep DevTools source build e2e in the Host program
```

`inspector-profile`（原 schedule-bundle 目录 R065 改名）：可选 Web profile 层 = 侧栏检查器 + 底部 NodeJS Inspector + Host fetch 捕获，Plugin Manager 默认关闭。

## 七、Web preset ↔ Coding Tools 解耦

```
3c26fdd204 feat(web): keep standard and creator presets available without coding tools
6200ffe8c7 fix(web): allow one-task Creator entry with Coding Tools off
d396f17f17 fix(web): filter advanced presets in settings when coding tools are off
9073ea1941 fix(web): clear unapplied coding presets when tools turn off
5d7a1f14e4 fix(web): preserve current preset when coding tools are disabled
f3946dc39a fix(web): reset hidden presets when coding tools are disabled
7d88fc9b2b refactor(web): limit plugin UX changes to add and create flows
ed50a72fc4 feat(web): connect plugin creation and usage entrypoints
16c485166c docs(web): clarify add-plugin actions and Creator flow
753fea38e6 fix(web): address preset review feedback and stale documentation
001e6f5e84 / 7a078907b6 / 93a7d221ed / e75c2ff098 / 66f00a9170   # Creator 流测试与文案
```

## 八、客户端 UI

```
2190082866 refactor(ui-chat): register composer stats pills as separate dock entries   # stats → activity + usage
88341c2a9f feat(layout): add a root-scoped bottom content slot
8463abc59d fix(sidebar): preserve Session Tab lifetimes and pane-local pages
0cad3a0137 feat(client): render Markdown YAML frontmatter as fields in document preview
39c614a143 fix(client): keep frontmatter preview robust and faithful to authored YAML
2ca5f648c3 test(client): pin first-line-only frontmatter detection
3843225471 fix(ui-goal): edit the goal objective in a multi-line editor
b88b6c248d fix(ui-goal): rebind the goal editor scrollbar and harden its Enter guard
66e101821c refactor(client): share the queued-message and goal inline editor
9a8d21dfe7 fix(goal-round-driver): withdraw a goal round parked by cancellation
b1a69a9b9c / 7a6cef7c92 fix(ui-goal): label disarmed goals
c74f39b4dc / fce0a41da8 / b5d7123351 fix(ui-tool): escalation 字段三连
4b9d8ad6f7 fix(client): re-pin StateDot loaders whose animation restarts
91818992b0 / a33bd1a80b / cd759d8a09 / 3bd1d3ef21 perf(web)/chore(client): 流式工具参数与 slot 目录
```

## 九、性能与基准

```
4402fa47e4 perf(api): time-slice Session list work
ecc01b54a4 perf(api): yield between Session list summaries
2ba4144a7e feat(web): show parsed tool arguments during preparation
b7f06692b6 fix(client): handle sealed deltas and Unicode summary boundaries
d70efffb63 test(bench): measure Session list, search, and fork over large corpora   # benchmarks/session-corpus 新基准
ed8a2a9163 / 92a65cbb65 / e806d9cb97 / bfcd447963 / 7deaab676f / 2778be7375 / 811940168a / 74fcbdd625
4028ce27e8 test(perf): exercise production conversation event routing
46400a91bf / 5d86fb0e79 benchmarks: reconnect 预算校准
```

## 十、Web / 桌面 / 部署

```
a7c3ad99bc feat(web): advertise a configured public application URL (#3972)   # + docs/user/guide/public-deployments.md
f3168f2be4 feat(web): 登录请求无响应时提示检查网络
dff4dfbe75 fix(desktop): 接受登录无响应错误码并补充升级说明                    # + account-sign-in-errors 指南
ecd9bf9273 fix(desktop): listen on an OS-assigned port by default
f80df0426c / d0cc135751 / 83f9dcac8f fix(web): 文件输入尺寸三连
```

## 十一、客户端 prompt / 草稿初始化

```
e400349e3a feat(client): initialize session prompts and preserve structured drafts
e6783c20fc fix(client): initialize draft lexicon after caching input shell
2c93df5620 fix(client): narrow prompt input and defer skill highlighting
9aa8e788ba / d7099f9e2e / a456015082 / 236ab7acbd docs(client): 初始化生命周期文档四连
32e5555699 / ae08c57c21 / ec6b275c64 / 7d3420126e test(web/client): 初始化测试适配
```

## 十二、发布 / 工程 / vendor

```
71086449e2 release(vendor): cordis 4.0.5-alpha.1, cosmokit 1.8.6-alpha.1, group 1.0.5-alpha.1,
             hmr 1.0.20-alpha.1, include 1.0.10-alpha.1, loader 1.0.6-alpha.1,
             logger-console 1.0.5-alpha.1, schemastery 3.18.5-alpha.1, timer 1.1.7-alpha.1
185b9c59e7 feat(release): support isolated npm channels
a809d9289d fix(release): preflight channels without relying on latest
c1dee0e6f6 test(release): allow inputs on manual publishing workflows
500614c0d5 fix(build): pin tsdown to the native config loader
f3013b2d8d fix(build): reject Node processes without TypeScript type stripping
d0916a8f90 / 541fcec02f chore(office): LibreOffice Kit 0.1.5
44d678e279 fix(docs): map example plugin aliases to themselves in doc-typecheck
fe56439edc / 40133c707f refine(ci): Electron 准备独立化
a1db5f13e8 / bbf599483e / c7f66d13a6 docs(notes): 决策记录归档体系整理
```

## 十三、其余修复

```
f37f19ab43 fix(subprocess): compare executable errors by name
aa2ae5c779 fix(file-upload): isolate receipts by session instance
e6c6ec668f fix(remotes): remove redundant session runtime dependency
a63d8979fa fix(tools): align PTC examples with argument order
4166dbd140 fix(tools): guide argument generation order
aa5334f1e0 / 015349e4ad fix(client-modules): 样式认领与失败工厂清理
2e3ab61940 fix(presets): own composition mounts in registry service
bab69fbec5 / 43c5f1e924 / 00b363074a / 0bd1492940 fix(plugin-manager): 页面语义四连
f3050951f1 fix(testing): preserve turn-end timeout diagnostics
23527f0df2 / 2a23b73e7b test(typert-loader): 轮询化与注释契约
05e2d90042 test(session-projection-cache): await fixture checkpoint writes
479de510ca test(subagent): dispose continuable fixtures before removing storage
59b29ed6bd style(test): format the browser error observer
```

## 完整提交清单

```bash
git log --oneline --no-merges dsh-v0.2.0-rc.2..dsh-v0.2.1-alpha.1          # 201 条
git log --oneline --merges dsh-v0.2.0-rc.2..dsh-v0.2.1-alpha.1             # 65 条
git diff --stat dsh-v0.2.0-rc.2..dsh-v0.2.1-alpha.1 | tail -1              # 4190 files, +51032/−32761
```
