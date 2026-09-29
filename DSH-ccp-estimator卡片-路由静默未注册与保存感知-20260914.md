# DSH 上下文压缩插件 estimator 卡片两个缺陷 —— 路由静默未注册 与 保存感知缺失

> 本文是「**功能看起来存在、实际不工作**」这一类缺陷的**根因案例与诊断 SOP**。
> 与 `DSH-ccp-单包修复-修复日志-20260914.md` 的分工：那份管**启动崩溃**类（D1–D5），本文管**运行时功能静默失效**类（A/B 两个缺陷）。
>
> 记录规则：一条缺陷一个 `A#`/`B#` 编号；一条记录必须含「现象 / 根因 / 取证证据 / 影响面 / 修法 / 验证手段」。**证据是指令与实测输出，不是对代码的描述。**

- 宿主：DSH `0.1.2-rc.1` @ `http://127.0.0.1:3080`
- 插件：`dsh-context-compression-improved` `0.1.0` @ `feat/ctx-preset-v2`（`935d501`），装于 `C:\Users\joshua\.dsh\profiles\web`
- 取证日期：2026-09-14
- 前置排除：profile 内的安装产物与仓库工作区**逐文件 SHA-256 一致**（`lib/client.js` `14E0F674…`、`lib/index.js` `EDAFE234…`、`lib/pruner.js` `012DE7EF…`），**不存在陈旧安装**这一干扰项。

---

## 1. 现象（用户真机反馈）

1. 选择「复用」后，**无法**根据已配置的项通过下拉弹窗填充 provider / 模型名。
2. 「自己填入参数」这类配置方式，**「保存」或「确定」的操作不明确**，对数据是否已保存缺乏感知。

---

## 2. 缺陷 A：`estimator-catalog` 路由运行时从未注册

### A1 现象

设置面板 estimator 区域的 provider / 模型名两个输入框**永远没有下拉候选**，即使宿主已配置了 provider。

### A2 取证证据（差分实测，决定性）

对运行中的宿主发起**裸 HTTP 请求（无任何凭据）**，比较"真实注册的路由"与"不存在的路由"：

| 请求路径 | 实测状态 | 含义 |
| --- | --- | --- |
| `/api/dsh-perm-gate/receiver` | **200**（1088 B） | 同宿主、同时刻、同样无凭据的**真实注册**路由 |
| `/api/dsh-perm-gate/learning` | **200**（212 B） | 同上 |
| `/api/definitely-not-a-real-route-12345` | **401** | 随机乱码 |
| `/api/dsh-perm-gate/definitely-not-real-9876` | **401** | 已注册插件的**乱码子路径** |
| `/api/dsh-context-compression-improved/nonexistent` | **401** | 本插件的乱码路径 |
| `/api/dsh-context-compression-improved/estimator-catalog` | **401** | ⚠️ **与本插件乱码路径无法区分** |
| `/endpoint/definitely-not-a-real-route-12345` | **404** | 该前缀在本宿主不存在 |
| `/endpoint/dsh-context-compression-improved/estimator-catalog` | **404** | 同上 |

**判定**：`401 不是"缺凭据"，而是"未命中任何已注册路由"**。判据是同一时刻 `dsh-perm-gate` 的真实路由在**同样无凭据**下返回 200。

401 的产生点：`dsh-client-connection/lib/index.js:419` 的 `writeUnauthorized()`，由 `authorizeIndex()`（L363–L401）在未通过浏览器 cookie 鉴权时调用，正文为：

```
dsh web authentication required; reopen the URL printed by dsh web.
```

也就是说：**已注册的路由在 SPA 鉴权门之前被匹配；未注册的 `/api/...` 才会落到鉴权门并得到 401。** 我们的路由返回的正是 401 ⇒ 它没注册上。

### A3 传导链

```
路由未注册
  → 客户端裸 fetch 得到 401
  → packages/selector/src/client/CompressionProfileSelector.tsx:416  `if (response.ok)` 为假
  → setCatalog 永不执行（L428）
  → hostProviders / hostModels 恒为空数组（L437/L443）
  → 两个 <datalist> 无任何 <option>（L504、L529）
  → 下拉填充必然失败，且 UI 不报任何错
```

**关键细节**：客户端 `load()`（L412–L421）用裸 `fetch`，只判断 `response.ok`；401 被静默吞掉，与"服务不存在"不可区分。

### A4 为什么一直隐身（三重盲区）

1. **宿主侧静默失败**：`packages/selector/src/index.ts:63` 是 `if (webServer === undefined) return` —— 零日志。
   对照可用参照 `dsh-perm-gate/lib/index.js:325`：`console.warn('[dsh-perm-gate] webServer service unavailable — … routes not registered')`。
2. **客户端只认 `response.ok`**：401 与 404 走同一条"继续试下一个前缀"的分支，最终静默返回 `undefined`。
3. **单测盲区**：`packages/selector/tests/estimator-channel.client.spec.tsx` 的 5 条用例**全部把 catalog 作为 mock 注入**，根本不经过真实 HTTP 路由，所以"路由未注册"这一层永远是绿的。

### A5 影响面

- 全部使用 estimator「复用（host）」模式的用户：宿主已配置的 provider / 模型**无法被复用**，功能名义存在、实际不可用。
- 因 A4-1 的静默性，该缺陷**不会**产生任何日志、崩溃或告警，只能靠主动差分实测发现。

### A6 修法

对齐 `dsh-perm-gate` 的成熟写法：

1. 插件级声明 `export const inject = ['tools', 'webServer', 'llm', 'agentDefaultModel']`，用 cordis 的**插件级服务门控**替代纯内部 `ctx.inject`。
2. 注册时双通道获取：`injected.webServer ?? fallbackGet('webServer')`，避免 `ctx.inject` 回调因任一服务未就绪而永不触发。
3. `webServer === undefined` 时输出**显式 warn**（含缺失服务名），禁止静默 return。
4. 注册后**自证**：断言 disposer 数量并打印已注册路径。
5. `/endpoint` 前缀在本宿主恒 404：保留兼容面但降噪，避免每次请求白赔一次 404 往返。

### A7 验证手段

- 差分实测：`/api/dsh-context-compression-improved/estimator-catalog` 必须返回 **200**，且与乱码路径的 401 可区分。
- 宿主侧新增守门：`webServer` 就绪后必须注册出至少一条 `/api` 路由；未注册即测试失败。
- 新增**负向用例**：路由未注册时客户端 `catalog` 保持 `undefined` 且不产生下拉项——堵住 A4-3 的盲区。

---

## 3. 缺陷 B：保存感知缺失

### B1 现象

「自己填入参数」时，**不确定数据是否已保存**。

### B2 取证证据（逐字段实测行为）

依据 `packages/selector/src/client/CompressionProfileSelector.tsx` L395–L601：

| 字段 | 提交时机 | 成功反馈 |
| --- | --- | --- |
| provider（host） | 仅 `onBlur`（L499），或 change 时命中 catalog 精确项（L496） | 无 |
| model（host） | 仅 `onBlur`（L526） | 无 |
| baseUrl（direct） | 仅 `onBlur`（L550） | 无 |
| apiKey（direct） | `onBlur` → `settle(save)` 后**立刻 `setKeyDraft('')` 清空输入框**（L578–579） | 无；只能靠 placeholder 从"未设置"变"已设置"**推断** |

`s settle()`（L79–L89）**只有失败分支**：成功路径是 `() => { setSaving(false) }`，不产生任何可见反馈；失败才写入 `saveError` 并渲染 `role="alert"`（L140）。

### B3 根因定性

**整个 estimator 卡片不存在任何「保存/确定」控件**——用户的措辞是字面准确的。全部依赖 `onBlur` 隐式提交。

两个次生问题：

1. `disabled={busy || !state.writable || …}`（L129）在每次 blur 提交时把**整块面板**闪成禁用态。
2. 输入后直接点击设置导航离开时，blur 与组件卸载存在竞态，值可能**根本没提交**。

### B4 排除项（写入层是健全的）

`packages/selector/src/client/index.ts:45-60` 的 `writeAndConfirm` 会做写后回读校验（比对 revision 变化 + 值匹配），失败抛 `Context compression settings were not saved.`。

**缺陷在交互层，不在写入层。** 修复不应触碰 `writeAndConfirm`。

### B5 修法（最小显式方案）

| 现状 | 改为 |
| --- | --- |
| 四处 `onBlur` 隐式提交 | 每个可输入区域配**显式「保存/确定」按钮**，且为唯一提交路径 |
| 成功路径零反馈 | **三态可见**：保存中（按钮禁用/文案）/ 已保存（确认态）/ 失败（`role="alert"` 保留错误原文） |
| apiKey 提交后自动清空 | **不清空**；改为"已设置"占位或掩码显示 |
| 整块面板禁用闪烁 | 仅禁用触发字段与按钮 |
| blur/卸载竞态丢值 | 显式按钮消除该竞态 |

**本轮明确不做**：dirty 状态圆点、离开面板拦截、乐观 UI 回滚。

### B6 验证手段

- 四处都有显式按钮，且移除 `onBlur` 隐式提交后原 5 条 client 用例按新交互更新且全绿。
- 真机：输入后立刻点击设置导航离开，值仍被提交。
- 真机：API key 提交后输入框不清空，且有明确成功态。

---

## 4. 复现与验证步骤（可照做）

```powershell
# 0) 确认安装产物与仓库一致（排除陈旧安装）
$w="C:\Users\joshua\.dsh\profiles\web\node_modules\dsh-context-compression-improved\packages\selector\lib"
$r="E:\test\rewrite-agently\mine-dsh-plugins\dsh-context-compression-improved\packages\selector\lib"
foreach ($f in @('client.js','index.js','pruner.js')) {
  (Get-FileHash "$w\$f").Hash -eq (Get-FileHash "$r\$f").Hash
}

# 1) 差分实测：真实注册路由 200 vs 未注册 /api 路径 401
foreach ($p in @(
  '/api/dsh-perm-gate/receiver',                                  # 对照：真实注册
  '/api/definitely-not-a-real-route-12345',                       # 对照：乱码
  '/api/dsh-context-compression-improved/estimator-catalog',      # 被测
  '/endpoint/dsh-context-compression-improved/estimator-catalog'  # 被测（旧前缀）
)) {
  try { $x=Invoke-WebRequest -Uri ("http://127.0.0.1:3080"+$p) -TimeoutSec 15 -UseBasicParsing
        "{0,-58} -> {1} len={2}" -f $p,$x.StatusCode,$x.Content.Length }
  catch { "{0,-58} -> {1}" -f $p, $(if($_.Exception.Response){[int]$_.Exception.Response.StatusCode}else{'ERR'}) }
}
```

**期望（修复后）**：被测路径返回 `200`；对照组保持 `200 / 401 / 404` 不变。
**当前（修复前）**：被测路径返回 `401`，与乱码路径无法区分。

---

## 5. 未决项（必须靠执行期探针，禁止推断）

- `ctx.inject(['webServer','llm','agentDefaultModel'], …)` 三个服务中**究竟哪个未就绪**——任一缺失则回调永不触发。静态阅读无法判定。
  因此修复的第一步是**加显式 warn 后跑一次真机定位**，而不是直接照抄参照插件的 inject 列表后宣称修复。
- `agentDefaultModel` 在本 profile 是否已挂载：`dsh-perm-gate` 声明了同名服务且其路由实测 200，但那是**它的注册路径**成立，不能据此推断我们的回调会触发。

---

## 6. 沉淀（已回填框架）

可复用规则已写入 `plugin-framework/upgrade-pitfalls.md` §二 **2.6**（「路由注册成功与否无法从代码判断：用 401/404 差分实测」）。
本文属主**证据与复现**，框架条目属主**通用规则**，两处不重复陈述。

---

## 7. 变更记录

| 日期 | 条目 | 动作 |
| --- | --- | --- |
| 2026-09-14 | A / B | 案例建档；两个缺陷均以实测证据定性；修法列入计划，未实施 |
