# tag 之后的 master：`worktree-bootfast2` 启动加速波

> **对比区间**: `dsh-v0.1.6-alpha.1` (`0a15e36e7f`) → `origin/master` (`0d1f50007f`)
> **区间规模**: 5 个提交（4 个实际变更 + 1 个 merge）｜ 130 files changed, 1272 insertions(+), 496 deletions(-)
> **性质**: **已合入 master、但尚未随任何 tag 发布**。写入本文是为了让 v0.1.6-alpha.1 的快照不被误当成"当前主干"。
> **日期**: 提交日期 2026-09-14 ~ 2026-09-15，merge 于 2026-09-15

---

## 一、区间构成

```
0d1f50007f  Merge pull request #4192 from deepseek-harness/worktree-bootfast2   ← master 当前 HEAD
e459e32637  perf(typert): materialize generated schemas on first use            38 files, +205/-162
232ab768a9  perf(runtime): defer optional native dependencies                   45 files, +375/-147
eb8cc594b3  feat(util): add caller-relative lazy require                        24 files, +334/-10
42286726c8  perf(web): defer client combo assembly                              27 files, +360/-179
────────────── 以下为已发布 tag 边界 ──────────────
0a15e36e7f  Merge pull request #4171 …/worktree/release-dsh-0.1.6-alpha.1       ← dsh-v0.1.6-alpha.1
ea53423b60  release(dsh): 0.1.6-alpha.1
```

**共性**：四条提交都指向同一个主题——**把"启动时必须完成的工作"推迟到"第一次真正用到时"**（boot fast / 启动提速）。它们不是新功能，而是启动路径的延迟化改造。

**结构影响**：`package.json` 计数 314 → **315**（新增 `packages/util/lazy-require` 一个包），`packages/` 分组数不变（仍 52）。

---

## 二、四条变更逐条说明

### 2.1 `perf(web): defer client combo assembly`（`42286726c8`）

**问题**：客户端组合脚本（combo script）与它的索引 source map 在启动期被立即拼接/读取，而 startup、index 渲染、脚本 `GET`/`HEAD` 其实都不需要 map。

**变更**（依据 `docs/subsystems/client-modules.md` 的区间 diff）：

| 维度 | tag 前 | tag 后 |
|---|---|---|
| combo 脚本 | 启动期即生成 | **首次 `GET` 时才拼接一次** |
| source map | 启动路径读取 | startup / index 渲染 / 脚本 `GET` / `HEAD` **都不读 map**；首次 map `GET` 才读取、校验、组合出一份 Indexed Source Map v3 并缓存 |
| combo `rev` 语义 | 对「拼接后的脚本字节 + 索引 source map」取哈希 | **由有序的 entry rev 派生** |
| graph `rev` 语义 | 对「内容 + bundle 哈希」取整图一致性锚 | 对 **entry 与 batch 描述符**取哈希 |
| HMR 后的行 rev | 新 bundle **与其 source map** 的哈希 | 新**可执行字节**的哈希（map 不再参与） |
| 路由行为 | `fetchBundle(request): Response` | **`async fetchBundle(request): Promise<Response>`**；`HEAD` 返回同样的不可变头但**不再物化 body** |
| 缓存 | 所有已通告响应长缓存 | **已物化**的响应长缓存 |

**API 影响（需要留意）**：`ClientModuleRegistry.fetchBundle()` 从同步返回 `Response` 变为**返回 `Promise<Response>`**，且新增 `fetchBundle()` 用于解析与 HTTP 路由同源的惰性响应。任何直接调用该方法的插件/host 侧代码需要 `await`。

同时更新了 `packages/client/modules`、`packages/client/ui-theme`、`packages/bundle/web-app/cordis.patch.yml`、`packages/client/web`、`packages/extensions/tool-cordis`，以及 `docs/subsystems/client-modules.md` 与 `.agents/notes/implemented/architecture/2026-08-15-client-shells-and-dynamic-packages.md`。

### 2.2 `feat(util): add caller-relative lazy require`（`eb8cc594b3`）

**新增包**：`@deepseek-ai/dsh-lazy-require`（`packages/util/lazy-require`）。

**用途**（引自该包 README）：让一个 **CommonJS 兼容的 Host 依赖**保持未加载状态，直到它的第一次真实操作；**解析仍相对于消费方包**，且**一个成功加载的模块值在该进程域内复用**。

```ts
import { createLazyRequire } from '@deepseek-ai/dsh-lazy-require'

interface NativeModule { open(): void }
const requireNative = createLazyRequire<NativeModule>('native-package', import.meta.url)
```

- 调用 `requireNative()` 才加载依赖；
- **加载失败不入缓存**；
- 显式传入 caller 的 `import.meta.url` 是为了在**发布之后**仍保持包内依赖解析。

**已知限制（原文明列）**：

| 限制 | 含义 |
|---|---|
| 仅支持 CommonJS 兼容依赖 | 纯 ESM 包需要由调用方自己拥有异步工厂 |
| WebWorker 打包需要显式请求 | 静态打包器**不会**发现只出现在 `createLazyRequire()` 调用中的依赖；用于 Preview 镜像的包必须让依赖继续通过受支持的**字面量请求**可达 |

**配套改动**：`scripts/package-dependency-policy.ts`、`scripts/verify-package-dependencies.ts`（含 spec）、`scripts/verify-package-readme-model-experience.ts`、`scripts/doc-standard.spec.ts`、`tsconfig.base.json`、`tsconfig.host.json`，以及 `docs/config-catalog.md` 与 `.agents/notes/implemented/process/2026-08-10-npm-release-sequences.md`。

> 该包是**平台型工具**：它是后面两条"延迟原生依赖"提交的实现基础。

### 2.3 `perf(runtime): defer optional native dependencies`（`232ab768a9`）

把若干**可选的原生/重量级依赖**从启动路径上摘下来，改为首次使用时加载：

| 包 | 延迟的依赖 | 相关文件 |
|---|---|---|
| `packages/attachment/attachment-local` | `sharp` | `src/sharp.ts`（新增）、`src/image.ts`、`src/normalization.ts`、`src/request-image.ts`；新增测试 `tests/lazy-sharp-failure.spec.ts` |
| `packages/sandbox/sandbox-windows-acl` | FFI | `src/ffi.ts` |
| `packages/subprocess/win32-process` | koffi / FFI | `src/ffi.ts`、`src/koffi.ts`、`src/process.ts` |
| `packages/subprocess/subprocess-local` | Linux execve / Windows inspector | `src/linux-execve.ts`、`src/windows-inspector.ts` |
| `packages/api/terminal-controller` | 终端相关可选依赖 | `src/terminal.ts` |

同时为受影响包补充了 `tsconfig` 面与 `package.json`，并更新 `docs/module-graph.md`、`benchmarks/package.json`。

**值得注意的一条**：新增的 `tests/lazy-sharp-failure.spec.ts` 说明**延迟加载把"依赖缺失"从启动期错误变成了首次调用期错误**——这正是该测试要固定的行为。

### 2.4 `perf(typert): materialize generated schemas on first use`（`e459e32637`）

**这是本区间唯一一处"类型契约变化"，对贡献 typert schema 的插件有直接影响。**

`TypertCodec` 的 strict 变体由：

```ts
{ readonly mode: 'strict'; readonly typeSymbol: string; readonly schema: TypertSchema }
```

改为：

```ts
{
  readonly mode: 'strict'
  readonly typeSymbol: string
  /** Materialize and return the process-realm schema on first boundary use. */
  readonly create: () => TypertSchema
}
```

（引自 `docs/subsystems/typert.md` 的区间 diff。）

配套的载入期校验也随之改变（`packages/typert/loader/src/index.ts`）：

| | tag 前 | tag 后 |
|---|---|---|
| schema 校验 | `typeof schema.schema !== 'object' \|\| !('_zod' in schema.schema)` → 报 "is not a zod v4 schema instance" | `typeof schema.create !== 'function'` → 报 "has no create() factory" |
| codec 校验 | 检查 `codec.schema` 是否为 zod v4 实例且带 `parse` | 检查 `codec.create` 是否为函数 |

也就是说：**载入器不再要求 schema 是一个 zod v4 实例对象，而是要求它提供一个 `create()` 工厂，由该工厂在首次跨边界使用时物化出本进程域的 schema**。相关 JSDoc 也从"返回 live schema record"改为"返回包含已缓存 schema 的记录"。

同时更新：`packages/typert/generator`（`src/emitter.ts` 与快照/单测）、`packages/api/gateway`、`packages/extensions/tool-cordis/src/api-catalog.ts`、`packages/typert/protocol`，以及 `docs/subsystems/typert.md` 与两篇 Agent Note（`2026-07-27-compiler-independent-typert-model`、`2026-08-02-typert-remote-method-calls`）。

---

## 三、对已交付文档的影响

| 本文档集里的结论 | 是否受本区间影响 |
|---|---|
| `package.json` 数 314、分组 52 | **需 +1 包**（`packages/util/lazy-require`），分组数不变 |
| `SESSION_FORMAT_VERSION = 3` | 不受影响 |
| `ClientModuleRegistry.fetchBundle()` 同步签名 | **在 master 上已变为 `Promise<Response>`**（`10-gui-frontend-backend.md` 若引用旧签名需以 tag 为准） |
| typert `TypertCodec.schema` | **在 master 上已变为 `create()`**（`04-llm-typer.md` 若引用旧形态需以 tag 为准） |
| 其余（能力族、默认值、manifest、解析代际） | 不受影响 |

> 结论：本文档集**以 tag `dsh-v0.1.6-alpha.1` 为快照基准**；本节列出的三项是"快照之后的漂移点"，供下一版分析时作为增量起点。

---

## 四、复现命令

```powershell
cd E:\test\rewrite-agently\deepseek-harness

git log --format='%h %ad %s' --date=short dsh-v0.1.6-alpha.1..origin/master
git rev-list --count dsh-v0.1.6-alpha.1..origin/master          # 5
git diff --stat dsh-v0.1.6-alpha.1..origin/master | Select-Object -Last 1

git show origin/master:packages/util/lazy-require/README.md
git diff dsh-v0.1.6-alpha.1..origin/master -- docs/subsystems/client-modules.md
git diff dsh-v0.1.6-alpha.1..origin/master -- docs/subsystems/typert.md
git diff dsh-v0.1.6-alpha.1..origin/master -- packages/typert/loader/src/index.ts
```

---

*文档生成时间: 2026-09-17*
*数据源: origin/master (0d1f50007f) vs dsh-v0.1.6-alpha.1 (0a15e36e7f)*
