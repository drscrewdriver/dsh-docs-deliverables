# DSH 客户端 UI 扩展接缝：权限选择器的可控面与硬编码面

> 适用场景：插件向权限选择器贡献自定义档位后，出现「图标缺失」「选中态显示文字而非图标」「风险确认弹窗不触发」等表现。
> 数据源：`@deepseek-ai/dsh-client-ui-conversation` / `@deepseek-ai/dsh-client-ui-permission-presets` 源码实测（DSH 0.1.5-rc.2，2026-09-15）。
> 实证插件：`dsh-perm-gate` —— 在既有 `permissive` 档之外新增第二个档位 `permissive-full`。

---

## 一、结论速查

插件档位在客户端有四条独立路径，**扩展性完全不同**：

| 面 | 机制 | 插件可控？ | 表现 |
|----|------|-----------|------|
| 档位**标签** | 回退到宿主提供的 `name:` | ✅ 可控 | 原样渲染，无需补丁 |
| 档位**说明** | 触发器的 `title`；设置页的 `detail` | ⚠️ 半可控 | 输入区**下拉里根本不显示** |
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

## 六、补丁的物理归属与失效边界（2026-09-15 复核）

§五 的补丁式方案有两个必须写进文档的边界：**它在哪、什么时候会没**。

### 6.1 三条路径是同一个物理文件

在一台标准安装上（Windows + nvm），下面三条路径**不是三份副本，而是一个 inode**：

| 路径 | 实测 |
|------|------|
| `C:\nodejs\node_modules\@deepseek-ai\dsh` | `LinkType=` 空 + `Target=` 有值 → **符号链接**，指向 `C:\nvm\v22.22.1\...\dsh` |
| `<profile>\node_modules\@deepseek-ai\dsh-client-ui-conversation` | `LinkType=Junction` → 指向宿主的同名包 |
| `C:\nvm\v22.22.1\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai\dsh-client-ui-conversation\lib\client.js` | 唯一实体 |

判定方法：对前两条路径各跑一次 `fsutil hardlink list`，**两次返回同一条 `\nvm\...` 路径** —— 即同一个文件。三者的大小/哈希/mtime 也完全相同。

**由此得出的两条硬结论**：

1. **`dsh plugin --profile web add …` 永远修不了这个补丁。** 它把参数转发给 profile 目录里的 pnpm，只写 profile 自己的 `node_modules`；而 profile 里那个目录只是个 junction，改它等于改宿主 —— 但**装包**动作本身不会去改宿主的文件内容。
2. **`-w` 也修不了。** `-w` 是 pnpm 的 `--workspace-root`；本 profile 的 `pnpm-workspace.yaml` 就是 `packages: ['.']`，所以它指向的就是 profile 根目录本身，语义上是空操作，更谈不上写进 DSH 安装树。

**唯一恢复路径**：DSH 升级/重装后重跑 `node scripts/patch-permission-glyph.mjs`。
（`dsh plugin --profile web update dsh-perm-gate` 升级**插件**不影响它 —— 补丁从来不属于插件。）

### 6.2 补丁脚本要按「运行中的 node」反推路径

不要硬编码 `C:\nodejs\...` 或 nvm 版本号。用 `dirname(process.execPath)` 逐级上溯：

```js
join(dirname(process.execPath), 'node_modules')                                        // 宿主 node_modules
join(dirname(process.execPath), 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai')
```

后者正好落在宿主包内的 `@deepseek-ai` scope。这样 nvm 换版本、`C:\nodejs` 软链重指都不会让脚本失效 —— 而硬编码路径会。

### 6.3 输入区下拉**不渲染 `description`**

这是本次复核新发现的一条，与图标问题叠加会放大困惑：

```js
// 输入区 dsh-client-ui-conversation —— items 只有三个字段
const items = value.options.filter(o => o.value !== "custom").map(option => {
  const icon = permissionGlyph(option.value);
  return { id: option.value, label: permissionLabel(option.value, option.name, t),
           ...(icon === void 0 ? {} : { icon }) };          // ← 没有 description
});
```

`description` 在输入区**只有一个去处**：收起态的触发器 `title={current?.description}` —— 也就是说

- 它只是一条 **hover tooltip**（触屏不可达）；
- 只对**当前已选中**的档位显示（展开菜单里看不到其他档位的说明）。

对照设置页（`dsh-client-ui-permission-presets`）的 `optionsOf()`，那里是带上的：

```js
...option.description !== void 0 ? { detail: option.description } : {}
```

**结论**：插件在「用户选择档位的那一刻」唯一能影响的就是 `label`（来自 `name:`）。想在输入区解释档位的代价，塞进 `name:` 是唯一不依赖补丁的办法 —— 但 `name:` 同时会进 `aria-label`，不是无代价的。

### 6.4 两种失败态的区分

| 现象 | 原因 | 对策 |
|------|------|------|
| 下拉里**整行消失** | `permission.config.presets` 被整体替换时漏写该档 | 补 `cordis.patch.yml`，重载 |
| 下拉里**行还在、只是没图标** | 宿主 bundle 被升级覆盖，补丁丢了 | 重跑补丁脚本，重载 |

第二种**不影响功能** —— 门禁照常生效，只是视觉不齐。把它当成升级后的常规收尾动作即可。

---

## 七、给插件作者的检查清单

- [ ] 档位 `name:` **不要用 kebab-case**，否则会被标题化
- [ ] 若需要图标，确认机器值是否已在宿主 `permissionGlyphs` 内；不在则必须补丁且**写明升级后需重跑**
- [ ] 补丁脚本必须：**幂等** + **按括号深度切片**（不用正则）+ **写后 `node --check` 并失败还原** + **从 `process.execPath` 反推路径**
- [ ] 不要把「升级后重跑补丁」和「重装插件」混为一谈 —— `pnpm add`（含 `-w`）只写 profile 的 `node_modules`，**恢复不了宿主补丁**
- [ ] 若档位 `sandbox: danger-full-access`，注意**不会触发内置风险确认** —— 需在 `description` 中自行写明代价
- [ ] `description` 在输入区**只是触发器的 hover tooltip**，展开菜单里不渲染；想让人在选择那一刻看懂代价，只有塞进 `name:`（代价是它同时进 `aria-label`）
- [ ] 档位标签只需写在 `cordis.patch.yml`，设置行与输入区共用同一渲染函数
