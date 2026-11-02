# Electron（desktop 宿主）限制与成因 — 案例版

> **本篇性质**：`dsh-prime-memory` 仓库 `docs/electron-constraints.md` 的**案例快照**（快照 2026-11-03）。真源在该仓（含代码锚与复跑脚本），本页供跨插件参考，**不在本库维护其参数级细节**。
> **面向**：想知道「插件跑在 DSH Desktop 里为什么会以奇怪方式坏掉」的开发者。作者-facing 的判据版（已剥离私有锚点）在 skill 仓 `dsh-plugin-dev/references/electron-host-constraints.md`。
> **配套**：规模/预算/自愈的案例数据见 [execution-scale-ledger-case.md](execution-scale-ledger-case.md)。

---

## 1. 为什么必须先分因

「T² 张量峰值」「BFCArena 高水位」是 **onnxruntime** 的机制，不是 Electron；Electron 决定的是「同一次分配会不会被拒」「原生模块能不能加载」「插件能不能自动装/挂」。混为一谈会开错药——例如去调 ORT 参数来治**安装**问题。

| 层 | 是什么 | 决定什么 | 典型表现 |
|---|---|---|---|
| **A. onnxruntime 内存机制** | attention 张量 `[1,heads,T,T]`（严格 O(T²)）；BFCArena 高水位不回落，相邻两次大推理的 T² 块**共存**（m=2） | 「峰值多大」 | 单发致死线 ≈2700 token、连发致死线 (1960,1976]；峰值随 T 平方增长 |
| **B. Electron/宿主运行时** | macOS 分配器行为、二进制即 Node（无独立 `node`）、asar 打包、原生模块 ABI、内建 `libvips` | 「同一次分配会不会被拒」「原生模块能不能加载、从哪加载」 | SIGTRAP（仅 macOS/宿主二进制）、`libvips-42.dll` 撞名、`node:sqlite`/`sqlite-vec` 装不上 |
| **C. 宿主产品设计** | desktop profile 由 Electron 应用独占管理；`dsh.pluginDependencies` 只保证装包、不产生挂载行为 | 「插件能不能自动装/自动启用依赖」 | `dsh plugin --profile desktop` 被拒；collector 装了但不跑 |

> 一句话：**A 决定病有多重，B 决定这一下会不会致命，C 决定你能不能自动给药。**

---

## 2. B 层逐条（运行时/加载面）

| # | 限制 | 成因（机制） | 对本插件的约束 | 处置 | 可自证性 |
|---|---|---|---|---|---|
| 1 | macOS 上被 **SIGTRAP** 打死（`EXC_BREAKPOINT`，栈底 `libsystem_malloc.dylib \| _malloc_zone_memalign`） | 崩溃是「一次大块对齐分配被**分配器**拒绝」，不是 OOM（崩溃瞬间机器 24GB 未满、writable resident 仅 3.4MB）。同一份代码在**纯 node 同参数 4/4 通过**、在宿主 Electron 二进制下必崩 ⇒ 差异在**宿主运行时**（分配器/分区/堆设置）这条失败路径；具体单因未定论 | 崩溃不可在本机复现，也不可用信号伪造（Windows 发不出 SIGTRAP） | ① 降 `T`（token 帽）② 降共存份数 m（关 memPattern）③ 崩了有界自愈（respawn）④ 把「是否仍 trap」交给报告人 macOS 回验 | ❌ 仅 macOS 宿主 |
| 2 | 子进程必须用 **`execPath: process.execPath`** | 打包后 PATH 里没有 `node`；宿主 Electron 二进制自带 Node 运行时，`fork()` 要用它才跑得起来 | 不能假定系统装了 node；不能用裸 `node` 启动 embedding-child | `store/local-embedding.ts` 显式传 `execPath: process.execPath`（并记录 execPath/release/pid 便于归因） | ✅ 代码 |
| 3 | 生产 fork **未显式**设 `ELECTRON_RUN_AS_NODE`（只有 `scripts/repro/*` 设了） | Electron 二进制默认以「应用」身份启动；要以 Node 语义跑脚本，惯例是 `ELECTRON_RUN_AS_NODE=1`。生产代码依赖**宿主环境的继承**，这层没有自证 | 打包态若宿主未注入该变量，子进程可能起成 Electron 而非 Node | 现状是「真机可跑（0.26.29 实测 child 拉起成功并回执）但本机不可自证」；若今后出现「子进程起不来」类故障，**优先查这一项** | ⚠️ 待核（装机期） |
| 4 | 同进程 **`libvips-42.dll` 名字冲突**（插件 runtime 的 sharp 与宿主 Electron 的 sharp） | Windows 的 `LoadLibrary` 按**模块名**解析：同进程里两份 `libvips-42.dll` 会互相顶掉，先加载者胜 | embedding 运行时（transformers/sharp）与宿主**不能同进程** | fix #11：把模型加载与 ONNX 推理整体放进 fork 子进程（子进程自带独立 DLL 表，冲突物理消失）。这条同时解决了「ORT 同步调用冻结宿主事件循环」 | ✅ 代码注释 + 真机 |
| 5 | 宿主提供的包**不在** profile 的 `node_modules` | 宿主类体在 `app.asar` 内、由 Electron 运行时提供；插件从 profile 目录解析依赖时看不到它们 | 不能假定「能 require 宿主的 dsh-* 运行时」；`stub ctx` 那类测法对本插件无效 | 只依赖显式声明在 `dependencies/peerDependencies` 的包；探针/读面走宿主注入或进程内直调（见 collector 读适配器的三次演进） | ✅ 代码（`scripts/verify-claims.mjs`） |
| 6 | **asar 打包**：原生 `.node` 不能从 asar 内 `dlopen` | Electron 的 asar 是虚拟文件系统；原生模块需要真实文件路径 | `sqlite-vec` 等原生绑定必须 unpacked / 位于真实目录 | 运行时依赖装到数据目录（`~/.dsh/memory/runtime`）而不是包内 asar；子进程用真实路径加载 | ✅ 代码注释 |
| 7 | 原生模块 **ABI** 必须匹配 Electron 的 `NODE_MODULE_VERSION` | Electron 自带 V8/Node 与系统 node 不同，二进制接口不兼容 | 用系统 node 编的 `.node` 装进 Electron 会 `NODE_MODULE_VERSION mismatch` | 装机期验证；运行时安装器按宿主 Node 版本装依赖 | ⚠️ 装机期 |
| 8 | Node 运行时下限 **>= 22.16.0** | `node:sqlite`（实验特性）+ `sqlite-vec` 原生绑定要求该版本起 | Electron 自带的 Node 必须够新，否则检索库不可用 | `engines.node` 声明 + 启动期能力探测（`getCapabilities()`）；降级为纯 FTS 而不是崩 | ✅ package.json |

> 注意区分：`node:sqlite` 是**内置模块**（只有版本门槛，无 ABI/asar 问题）；`sqlite-vec` 是**原生绑定**（ABI + asar 两类问题都有）。二者的失败模式完全不同。

---

## 3. C 层逐条（安装与装配面）

| # | 限制 | 成因（机制） | 处置 | 可自证性 |
|---|---|---|---|---|
| 9 | `dsh plugin --profile desktop add` **必被拒**（`profile "desktop" is managed exclusively by the Electron application`） | desktop profile 的所有权在 Electron 应用侧，CLI 只是外部进程；这不是权限 bug 而是产品边界 | 设置面板 banner 直接给出**唯一可行链路**：手改 profile `package.json`（dependencies + `dsh.profile.bundles`）→ `pnpm install` → 重启 | ✅ 实测 |
| 10 | **`dsh.pluginDependencies` 装 ≠ 跑** | 宿主 boot 层**从不读取** `pluginDependencies`（0.2.1-rc.1 源码与 0.2.1-rc.5 `app.asar` 全文扫描均 0 命中）；是否 `apply()` 由 profile 的 `dsh.profile.bundles` → 合并各包 `cordis.patch.yml` 的 `insert` 决定 | 不自动挂载依赖；改为**把「装了没启用」显式暴露给用户**（五态 banner），并明确「只开启记忆不会自动启用参考会话库」 | ✅ 代码 + 实测 |

---

## 4. 三个「本机不可终判」项

| 项 | 为什么不可自证 | 裁决方式 |
|---|---|---|
| macOS 分配器 trap（#1） | Windows/Linux 的分配器对「大块对齐分配失败」返回 NULL（ORT 抛 OOM），不产生 SIGTRAP；`process.kill(pid,'SIGTRAP')` 在 Windows 抛 `EINVAL` | 报告人在 macOS 跑 `scripts/repro/embedding-repeat-crash.repro.mjs` |
| `ELECTRON_RUN_AS_NODE`（#3） | 本机跑的是仓库源码 + 系统 node，没有「打包态 Electron 二进制」这个对象 | 装机后看子进程能否拉起（日志有 `execPath=`/`pid=`） |
| 原生模块 ABI（#7） | 本机 node_modules 是按当前 node 装的，换成 Electron 才暴露 | 装机期 `sqlite-vec` 加载成功率 + `verify-desktop-smoke` |

---

## 5. 可复用结论（案例提炼）

1. **在 Electron 宿主里，任何「原生重活」默认放子进程**：一举解决 DLL 撞名、事件循环冻结、以及「崩了别拖死宿主」三件事；代价是协议化（`warmup/embed/embedProgress/settled` + `ack`）。
2. **子进程启动参数要显式、可归因**：`execPath`、`process.release.name`、`pid`、生效预算全部落日志——#22 的归因就是靠「崩溃报告 ↔ 日志」对毫秒时间戳完成的。
3. **不要把 ORT 的问题算到 Electron 头上**：T² 峰值与 arena 高水位用 ORT 自己的旋钮（token 帽、`enableMemPattern`）；Electron 侧只能通过「不把大块分配逼到极限」间接帮忙。
4. **「装了没启用」必须可观测**：依赖声明不产生运行时行为时，用户看到的是「功能静默为空」。宁可在设置页多一条 banner，也不要让用户自己猜。
5. **不可自证的部分写进边界，不要写成结论**：所有对外文字遵守「不写消除崩溃 / 不写自愈不丢向量 / 1536 是经验值非证明」。

---

## 6. 证据与复跑入口（原仓）

```bash
# 装机后可自证的部分（产物断言 / 宿主监听口 / 进程内读端到端）
node scripts/verify-desktop-smoke.mjs

# 宿主提供包不在 profile node_modules 的反证（stub ctx 法不适用）
node scripts/verify-claims.mjs

# macOS 连发崩溃复现（三重门：darwin + DSH_REPRO_LOCAL_EMBED=1 + 本机有模型/宿主）
node scripts/repro/embedding-repeat-crash.repro.mjs --chars 5000 --count 5 --budget 2048 --mode electron
```

代码锚（原仓）：`store/local-embedding.ts`（execPath / 子进程通道 / respawn）、`resources/embedding-child.cjs`（会话选项）、`clients/drsc-inproc.ts`（依赖探针）、`clients/web-server-origin.ts`（asar 内类体取 origin）。

---

*快照来源：`mine-dsh-plugins/dsh-prime-memory/docs/electron-constraints.md`（2026-11-03）。该文自身标注「证据面随版本推进，值以代码为准」——引用前请回原仓核对当前版本。*
