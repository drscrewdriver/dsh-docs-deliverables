# DSH 客户端 UI 扩展接缝：权限选择器的可控面与硬编码面

> 适用场景：插件向权限选择器贡献自定义档位后，出现「图标缺失」「选中态显示文字而非图标」「风险确认弹窗不触发」等表现。
> 数据源：`@deepseek-ai/dsh-client-ui-conversation` / `@deepseek-ai/dsh-client-ui-permission-presets` 源码实测（DSH 0.1.5-rc.2，2026-09-15）。
> 实证插件：`dsh-perm-gate` —— 在既有 `permissive` 档之外新增第二个档位 `permissive-full`。

---

## 一、结论速查

插件档位在客户端有三条独立路径，**扩展性完全不同**：

| 面 | 机制 | 插件可控？ | 表现 |
|----|------|-----------|------|
| 档位**标签** | 回退到宿主提供的 `name:` | ✅ 可控 | 原样渲染，无需补丁 |
| 档位**图标** | 闭包内 `Map`，按机器值查 | ❌ **封闭** | 非设计集内 → 无图标 |
| **风险确认弹窗** | 按机器值硬编码判断 | ❌ **封闭** | 非 `danger-full-access` → 不弹 |

**核心事实：DSH 客户端只认它自己的「设计集」，插件贡献的档位在 UI 上是一等公民的只有标签。**

---

## 二、档位标签：✅ 唯一有扩展性的面

`dsh-client-ui-permission-presets/lib/client.js`：

```js
const PRESET_LABEL_KEYS = new Map([
  ["read-only", "preset.readOnly"],
  ["workspace-write", "preset.workspaceWrite"],
  ["danger-full-access", "preset.fullAccess"]
]);

function displayPermissionPreset(value, name, t) {
  const key = PRESET_LABEL_KEYS.get(value);
  if (key !== void 0 && (name === value || name === DEFAULT_PRESET_LABELS[key]))
    return t?.(key) ?? DEFAULT_PRESET_LABELS[key];
  return displayPresetName(name);        // ← 回退分支
}

function displayPresetName(name) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return name;   // 非 kebab-case → 原样返回
  return name.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}
```

**要点**：

- 内置三档走本地化字典；其余全部落到 `displayPresetName(name)`。
- `name` 是宿主在 `cordis.patch.yml` 里写的 `name:`。
- **名字不要写成 kebab-case**，否则会被标题化（`my-tier` → `My Tier`）。写中文/带括号的产品名会原样渲染。
- 设置行与输入区**共用同一个函数**，所以补丁一处、两处都生效。

---

## 三、档位图标：❌ 封闭 Map，无插件接缝

`dsh-client-ui-conversation/lib/client.js`：

```js
/** Glyph for a permission option value; host-configured names outside the design set get none. */
function permissionGlyph(value) { return permissionGlyphs.get(value); }

const permissionGlyphs = new Map([
  ["read-only",        <svg shield+check/>],
  ["permissive",       <svg shield+eye/>],       // ← 自动审查 的图标是 DSH 自带的
  ["workspace-write",  <svg/>],
  ["danger-full-access", <svg/>],
]);
```

渲染处：

```js
// 下拉行
const items = value.options.filter(o => o.value !== "custom").map(option => {
  const icon = permissionGlyph(option.value);
  return { id: option.value, label: permissionLabel(...), ...(icon === void 0 ? {} : { icon }) };
});

// 选中态（触发器）
permissionGlyph(currentValue) !== void 0 && <span className={triggerIcon}>{permissionGlyph(currentValue)}</span>
<span className={triggerLabel}>{currentLabel}</span>
```

**为什么插件补不了**（两条都已实测确认）：

1. `permissionGlyphs` 是**闭包变量**，不导出、不经服务暴露。
2. 宿主提供的 option 对象只有 `{value, name, description}` —— 渲染器**只读 `option.value` 与 `option.name`**，没有 icon 字段可填。
3. 源码注释直说了这是设计：*host-configured names outside the design set get none*。

**表现**：下拉行无图标；**选中态因为 `permissionGlyph()` 返回 `undefined`，整个 `<span class="triggerIcon">` 不渲染**，于是该档位显示为纯文字 —— 而同排的其他档位都是图标+文字。视觉上明显不齐。

**唯一可行解**：扩展那张 Map 本身（见 §五）。

---

## 四、风险确认弹窗：⚠️ 按机器值硬编码

输入区（`dsh-client-ui-conversation`）：

```js
const FULL_ACCESS = "danger-full-access";
const choose = (id) => {
  setOpen(false);
  if (id === value.currentValue) return;
  if (id === FULL_ACCESS) { setAcknowledged(false); setConfirmation(id); return; }  // 弹确认
  submit(id);                                                                       // 直接生效
};
```

设置行（`dsh-client-ui-permission-presets`）同样：

```js
if (id === "danger-full-access") { setConfirmingFullAccess(true); return; }
select(id);
```

**判定依据是机器值，不是 `sandbox` 模式。**

**推论（对插件档位是个真实风险）**：若插件声明一个 `sandbox: danger-full-access` 的自定义档位，它会拿到与内置完全权限**相同的文件权限**，却**不触发任何风险确认** —— 用户点一下即生效，没有任何警示。

> `dsh-perm-gate` 的 `permissive-full` 正是这种档位。当前仅靠 `name`/`description` 自解释（「高权限」+ 明确写出「无系统沙箱兜底」），**并未解决弹窗缺失**。这是已知未闭合项。

---

## 五、规避与复现

### 5.1 图标：扩展宿主 Map（补丁式，须可重放）

因无插件接缝，只能改宿主包。`dsh-perm-gate` 的做法可参考：

```js
// scripts/patch-permission-glyph.mjs —— 把 ["permissive", …] 复制为 ["permissive-full", …]
const permissionGlyphs = new Map([
  ["permissive",      <svg shield+eye/>],
  ["permissive-full", <svg shield+eye/>],   // ← 副本
  ...
]);
```

工程要求（这个脚本被实测调过一轮）：

| 要求 | 原因 |
|------|------|
| **幂等** | DSH 每次升级后需重跑；重复执行必须无副作用 |
| **按括号深度定位，不用正则** | SVG 的 `d` 属性里含大量字符，正则会切错；首版按 `(` 起扫导致切片错位、产出坏文件 |
| **写后 `node --check`** | 该守卫在开发中确实拦下了一次坏切片，并自动还原备份 |
| **明确标注「改的是宿主包」** | 升级/重装即丢失，必须重跑 |

### 5.2 风险确认：目前无解，只能文档化

客户端按机器值硬编码，插件侧没有接缝。可选：

- 接受，靠档位命名与描述自解释；
- 向 DSH 上游申请「插件档位可声明 `requiresConfirmation`」的契约。

### 5.3 快速复现（判断一个插件档位有没有图标）

```
1. 安装一个贡献自定义权限档位的插件
2. 打开输入区的权限选择器
3. 观察：该档位在下拉行有无图标？选中后触发器是「图标+文字」还是「纯文字」？
4. 对照源码：grep permissionGlyphs <dsh>/@deepseek-ai/dsh-client-ui-conversation/lib/client.js
   —— 判断该档位的机器值是否在 Map 内
```

---

## 六、给插件作者的检查清单

- [ ] 档位 `name:` **不要用 kebab-case**，否则会被标题化
- [ ] 若需要图标，确认机器值是否已在宿主 `permissionGlyphs` 内；不在则必须补丁且**写明升级后需重跑**
- [ ] 若档位 `sandbox: danger-full-access`，注意**不会触发内置风险确认** —— 需在 `description` 中自行写明代价
- [ ] 档位标签只需写在 `cordis.patch.yml`，设置行与输入区共用同一渲染函数
