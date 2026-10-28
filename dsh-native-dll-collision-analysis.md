# DSH 插件 Native DLL 冲突模式分析与通用判据

> 起源案例：dsh-prime-memory Issue #11（2026-10，sharp/libvips 同进程去重致宿主崩溃）  
> 本文抽象为通用检查模式，适用于任何在 Electron 宿主进程中引入 native binary 的 DSH 插件。

---

## 1. 问题本质

Windows `LoadLibrary`（及 Linux `dlopen`、macOS `dlopen`）按**文件名**去重，范围是**进程地址空间**。同一进程内，若两份同名 DLL 来自不同目录/不同版本，只有先加载者生效——后加载者拿到的其实是先加载者的实例。

当 DSH 插件（或其 runtime install）引入的 native binary **文件名**与宿主已加载的相同时：
- 版本/ABI 兼容 → 侥幸没事（但脆弱，任一方升级即破）
- 版本/ABI 不兼容 → 崩溃或功能静默损坏

**worker_threads 不能隔离此问题**（共享进程地址空间）；只有**子进程**才有独立 DLL 命名空间。

---

## 2. 案例详解：prime-memory #11

### 冲突链路

```
embedding-worker.cjs
  └─ createRequire(RUNTIME_DIR/package.json)
     └─ require('@huggingface/transformers')     ← runtime/node_modules
        └─ require("sharp")                       ← transformers CJS 入口顶层硬依赖
           └─ LoadLibrary("libvips-42.dll")       ← runtime 的 8.17.3 版本
宿主 Electron 进程
  └─ require("sharp")                             ← 宿主自己的 node_modules
     └─ LoadLibrary("libvips-42.dll")            ← 宿主的 8.18.7 版本
→ Windows 按文件名去重 → 后加载者拿到先加载者的实例 → ABI 不匹配 → 崩
```

### 关键事实

| 维度 | 值 |
|---|---|
| 宿主 sharp | 0.35.5（libvips 8.18.7） |
| runtime sharp（由 transformers 拖入） | 0.34.5（libvips 8.17.3） |
| 同名文件 | `libvips-42.dll` |
| 触发条件 | 用户在运行中切换本地嵌入模型（首次加载 runtime） |
| 表现 | 切换瞬间宿主崩溃 / 图片功能坏（反向则宿主拿到旧版） |

### 修复方案（已选定：子进程隔离）

```
Before: 宿主进程 ─┬─ 主线程
                  └─ worker_thread (embedding-worker.cjs) → DLL 撞名

After:  宿主进程 ─── 主线程
                     │
                     └─ fork() ──→ 子进程 (embedding-child.cjs) → 独立 DLL 表
```

---

## 3. 通用冲突判定模型

### 必要条件（三条同时满足才会冲突）

| # | 条件 | 说明 |
|---|---|---|
| C1 | 插件在同进程内加载 native binary | worker_threads 算同进程；child_process 不算 |
| C2 | 宿主（或另一插件）也加载了**同文件名**的 native binary | 比对 basename，不看版本 |
| C3 | 两者 ABI/版本不同 | 同源同版本则侥幸安全，但仍脆弱 |

### 宿主已知 native 清单（2026-10 实测）

| 宿主加载的 DLL/so/dylib | 来源包 | basename |
|---|---|---|
| `libvips-42.dll` | `@img/sharp-win32-x64` (sharp 0.35.5) | `libvips-42.dll` |
| `libvips-cpp-8.18.7.dll` | 同上 | `libvips-cpp-8.18.7.dll` |
| `sharp-win32-x64-0.35.5.node` | 同上 | `sharp-win32-x64-0.35.5.node` |

宿主**不加载** `sqlite_vec.dll`、`jieba.win32-x64-msvc.node` 等（已验证 node_modules 无此类包）。

### 插件侧引入 native 的三种路径

| 路径 | 示例 | 风险 |
|---|---|---|
| 插件 package.json 的 dependencies | `sqlite-vec`, `@node-rs/jieba` | 直接从插件自身 node_modules 加载；宿主不用则安全 |
| runtime install（独立 npm ci 到数据目录） | prime-memory 的 `runtime/node_modules/sharp` | 与宿主不在同一 npm tree，版本独立 → 易撞 |
| 间接依赖链（第三方包顶层 require） | `@huggingface/transformers` → `require("sharp")` | 不可绕过、不可懒加载 |

---

## 4. 通用检查脚本思路

```bash
# 1. 枚举插件 runtime 侧所有 native 文件的 basename
find <dataDir>/runtime/node_modules -name "*.dll" -o -name "*.node" -o -name "*.so" -o -name "*.dylib" \
  | xargs -I{} basename {} | sort -u > plugin_natives.txt

# 2. 枚举宿主 node_modules 中已知 native basename
find <host>/node_modules -name "*.dll" -o -name "*.node" -o -name "*.so" -o -name "*.dylib" \
  | xargs -I{} basename {} | sort -u > host_natives.txt

# 3. 取交集 = 潜在冲突面
comm -12 plugin_natives.txt host_natives.txt
```

交集非空 → 必须满足以下之一才放行：
- a) 该 native 在子进程中加载（不在宿主进程地址空间内）
- b) 版本完全对齐且来源一致（脆弱，不推荐作为长期方案）
- c) 文件不实际被加载（证明该依赖链在当前配置下走不到）

---

## 5. 隔离方案选择表

| 方案 | 改动面 | 隔离度 | 适用条件 |
|---|---|---|---|
| **子进程 fork** | 中（改执行模型 + IPC） | 完全（独立进程） | 通用，首选 |
| 删除 runtime 中的冲突包 | 小 | 无（若间接链不可跳过则不可行） | 仅当该 native 确实不被代码路径触达 |
| 对齐版本（共享宿主那份） | 小但脆弱 | 无（同版本侥幸安全） | 版本追踪成本可接受的短期方案 |
| DLL side-by-side（manifest） | 大（需重编译宿主） | 完全 | Windows 专用，Electron 宿主不可控 |

---

## 6. 当前 drscrewdriver 仓库排查结论（2026-10-22）

| 仓库 | 是否引入 native | 与宿主重名 | 结论 |
|---|---|---|---|
| dsh-prime-memory | sharp + sqlite-vec + jieba | sharp ✓ | **有 #11**；sqlite-vec/jieba 安全 |
| dsh-session-steward | 无 | — | 安全 |
| dsh-session-guard | 无 | — | 安全 |
| dsh-input-traffic | 无 | — | 安全 |
| dsh-thinking-levels | 无 | — | 安全 |
| dsh-browser-cdp | 无 | — | 安全 |
| dsh-perm-gate | 无 | — | 安全 |
| 其余 20+ 仓库 | 无 | — | 安全 |

---

## 7. 预防纪律（写入 gate-checklist G7）

凡插件满足以下**任一**条件时，发版前**必须**跑 native collision check：
1. `package.json` dependencies 含 native addon 包（`better-sqlite3`/`sqlite-vec`/`sharp`/`@node-rs/*`/`onnxruntime-node` 等）
2. 存在 `runtime-package-lock.json`（runtime install 模式）
3. 任何依赖的 CJS 入口在顶层 `require` 了含 native 的包

检查不过 → BLOCK 发版，除非有子进程隔离证明。
