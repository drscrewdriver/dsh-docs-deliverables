# 权限选择器图标机制分析（专项）

> **版本**：v0.1.2-rc.1
> **问题**：输入区权限选择器中"自动审查"(permissive) 缺少图标
> **分析来源**：运行时源码逆向 + cordis.patch.yml

---

## 一、架构总览

权限选择器在 DSH 中有**两个显示面**：

| 显示面 | 所属模块 | 用途 |
|--------|---------|------|
| 输入区（Composer）触发器 | `dsh-client-ui-conversation` | 会话内实时切换权限档位 |
| 设置页 General 行 | `dsh-client-ui-permission-presets` | 设置新会话默认权限档位 |

两者都从同一个 `permissions` session projection 读取选项列表，但图标系统各自独立。

---

## 二、输入区权限选择器（核心问题所在）

### 2.1 图标映射表

**文件**：`@deepseek-ai/dsh-client-ui-conversation/lib/client.js`（第 15072 行）

```javascript
const permissionGlyphs = new Map([
  ["read-only",        <svg>盾牌+对勾</svg>],
  ["workspace-write",  <svg>盾牌+铅笔</svg>],
  ["danger-full-access", <svg>盾牌+感叹号</svg>]
]);

function permissionGlyph(value) {
  return permissionGlyphs.get(value);  // permissive → undefined → 无图标
}
```

**三个内置图标的 SVG 概要**：

| 机器值 | 图标描述 | 关键 path |
|--------|---------|----------|
| `read-only` | 盾牌轮廓 + 对勾 | `shieldOutline` + checkmark path |
| `workspace-write` | 实心盾牌 + 铅笔 | 4 个 path（盾体 + 编辑图标） |
| `danger-full-access` | 盾牌轮廓 + 感叹号 | `shieldOutline` + "!" 两个 path |

### 2.2 图标在 UI 中的使用位置

**触发按钮（当前选中值的图标）**：
```javascript
// 第 15237-15241 行
permissionGlyph(currentValue) !== void 0 && (
  <span className="triggerIcon" aria-hidden>
    {permissionGlyph(currentValue)}
  </span>
)
```

**下拉列表每项的图标**：
```javascript
// 第 15185 行
const icon = permissionGlyph(option.value);
// 在 Menu 组件的 items 中传递
```

### 2.3 标签文本系统

**文件**：同上（第 15154-15167 行）

```javascript
const BUILT_IN_PERMISSION_NAMES = new Map([
  ["read-only",       en["access.preset.readOnly"]],    // "Read Only"
  ["workspace-write", en["access.preset.workspaceWrite"]], // "Workspace Write"
  ["danger-full-access", en["access.preset.fullAccess"]]  // "Full access"
]);

function permissionLabel(value, name, t) {
  const builtInName = BUILT_IN_PERMISSION_NAMES.get(value);
  if (builtInName !== void 0 && (name === value || name === builtInName)) {
    // 内置档位 → 走本地化 key
    if (value === "read-only") return t("access.preset.readOnly");
    if (value === "workspace-write") return t("access.preset.workspaceWrite");
    if (value === FULL_ACCESS) return t("access.preset.fullAccess");
  }
  // 非内置档位（如 permissive）→ displayName() 处理
  return displayName(name);
}
```

`displayName()` 逻辑：
- 如果 `name` 匹配 kebab-case 正则 → 转 Title Case（如 `workspace-write` → `Workspace Write`）
- 否则原样返回（`自动审查` 不匹配 kebab-case → 直接显示 `自动审查`）

**结论**：标签文本能正确显示"自动审查"（因为 cordis.patch.yml 中 `name: 自动审查`），但图标为空。

---

## 三、设置页权限选择器

### 3.1 标签系统

**文件**：`@deepseek-ai/dsh-client-ui-permission-presets/lib/client.js`

```javascript
const PRESET_LABEL_KEYS = new Map([
  ["read-only", "preset.readOnly"],
  ["workspace-write", "preset.workspaceWrite"],
  ["danger-full-access", "preset.fullAccess"]
]);

function displayPermissionPreset(value, name, t) {
  const key = PRESET_LABEL_KEYS.get(value);
  if (key !== void 0 && (name === value || name === DEFAULT_PRESET_LABELS[key]))
    return t?.(key) ?? DEFAULT_PRESET_LABELS[key];
  return displayPresetName(name);
}
```

设置页的 Menu 组件**不使用 `permissionGlyphs`**，而是通过 `items` 的 `icon` 字段传递。当前设置页 Menu 渲染中，权限选项也**没有图标**——设置页整体对图标支持较弱。

### 3.2 设置页词典

```javascript
// settings.permission 词典
"preset.readOnly": "仅可查看",
"preset.workspaceWrite": "工作区内修改",
"preset.fullAccess": "完全权限",
```

`permissive` 的显示名来自 cordis.patch.yml 中的 `name: 自动审查`，不走内置词典。

---

## 四、权限 Preset 注册机制

### 4.1 cordis.patch.yml 注册

**文件**：`dsh-perm-gate/cordis.patch.yml`

```yaml
- id: permission
  config:
    presets:
      read-only:
        sandbox: read-only
        approval: ask
      workspace-write:
        sandbox: workspace-write
        approval: ask
      permissive:                    # ← 自定义档位
        sandbox: workspace-write
        approval: ask
        name: 自动审查              # ← 用户可见名
        description: 独立审批档……
      danger-full-access:
        sandbox: danger-full-access
        approval: never
```

注释明确写道：
> "The tier carries no icon. The built-in glyphs the composer draws are keyed by the three built-in values, and a plugin tier deliberately has none."

### 4.2 DSH 基础 cordis.patch.yml

**文件**：`@deepseek-ai/dsh-base/cordis.patch.yml`

```yaml
- id: permission
  name: '@deepseek-ai/dsh-permission-presets'
  config:
    presets:
      read-only:
        sandbox: read-only
        approval: ask
      workspace-write:
        sandbox: workspace-write
        approval: ask
      danger-full-access:
        sandbox: danger-full-access
        approval: never
```

只有三个内置档位。`permissive` 由 `dsh-perm-gate` 通过 bundle patch 叠加。

### 4.3 权限 Projection

`permissions` projection 从 session 事件流中读取当前预设，返回：

```typescript
{
  currentValue: string;           // 当前机器值，如 "permissive"
  options: Array<{
    value: string;                // 机器值
    name: string;                 // 显示名（来自 cordis.patch.yml 的 name:）
    description?: string;         // 描述
    sandbox: SandboxMode;
    approval: ApprovalPolicy;
  }>;
}
```

---

## 五、根因总结

| 层级 | 问题 | 位置 |
|------|------|------|
| **图标映射** | `permissionGlyphs` Map 只有 3 个内置项，无 `permissive` | `dsh-client-ui-conversation/lib/client.js:15072` |
| **架构设计** | cordis.patch.yml 注释明确说插件档位"deliberately has none" | `dsh-perm-gate/cordis.patch.yml:17-18` |
| **标签文本** | 正常工作，`name: 自动审查` 正确传递 | — |

**修复方向**：在 `permissionGlyphs` Map 中增加 `["permissive", <svg>...</svg>]` 条目。

---

## 六、修复方案

### 方案 A：修改 DSH 核心（`dsh-client-ui-conversation`）

在 `permissionGlyphs` Map 中增加 permissive 的 SVG 图标：

```javascript
const permissionGlyphs = new Map([
  ["read-only", ...],
  ["workspace-write", ...],
  ["danger-full-access", ...],
  // 新增：
  ["permissive", <svg>盾牌+自动审核图标</svg>]
]);
```

**优点**：一次修复，所有使用 `permissionGlyph()` 的地方都生效
**缺点**：修改 DSH 核心代码，非插件能力

### 方案 B：通过 Cordis Slot 注入（如果 DSH 支持）

如果 DSH 的 `conversation.input.dock` slot 允许覆盖 PermissionSelect 组件，插件可以在自己的 client.js 中重新注册带图标的版本。

**需要确认**：DSH 是否允许 slot 覆盖同一 id 的注册。

---

## 七、相关文件索引

| 文件 | 作用 |
|------|------|
| `dsh-client-ui-conversation/lib/client.js:15072` | `permissionGlyphs` 定义 |
| `dsh-client-ui-conversation/lib/client.js:15143` | `permissionGlyph()` 函数 |
| `dsh-client-ui-conversation/lib/client.js:15154` | `BUILT_IN_PERMISSION_NAMES` |
| `dsh-client-ui-conversation/lib/client.js:15168` | `PermissionSelect` 组件 |
| `dsh-client-ui-permission-presets/lib/client.js:69` | `PRESET_LABEL_KEYS` |
| `dsh-client-ui-permission-presets/lib/client.js:95` | `displayPermissionPreset()` |
| `dsh-perm-gate/cordis.patch.yml:17` | "The tier carries no icon" 注释 |
| `dsh-base/cordis.patch.yml:235` | 内置 permission presets 定义 |
| `dsh-perm-gate/lib/config.js:49` | `DEFAULT_GATE_PRESETS = ['permissive']` |
