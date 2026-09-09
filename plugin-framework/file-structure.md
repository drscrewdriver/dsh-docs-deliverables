# DSH Plugin 标准文件组成

> 本文档描述 DSH 外部插件的两种标准文件结构：JS 为主 和 TS 为主。

---

## JS 为主（宿主半 .js，客户端半 .ts/.tsx）

```
dsh-<plugin-name>/
├─ src/
│  ├─ index.js                   ← 宿主入口（纯 JS，直接发布）
│  ├─ <module-a>.js              ← 宿主业务模块
│  ├─ <module-b>.js
│  └─ client/
│     ├─ index.ts                ← 客户端入口
│     ├─ locales.ts              ← 多语言字典
│     └─ <component>.tsx         ← React 组件
│
├─ lib/
│  ├─ client.js                  ← tsdown → CJS browser bundle
│  └─ client.js.map
│
├─ assets/                       ← 市场展示图片（screenshots.json 引用的实际文件）
│  └─ .gitkeep
│
├─ cordis.patch.yml              ← cordis bundle patch
├─ dsh.plugin.json               ← DSH 插件清单
├─ package.json                  ← npm 元数据
├─ tsdown.config.ts              ← 客户端 bundle 构建配置
├─ screenshots.json              ← 市场展示图片清单（awesome-dsh-plugin 卡片用）
├─ README.md (四语)
├─ CHANGELOG.md (四语)
└─ LICENSE
```

**特点**：`src/*.js` 直接发布进 npm，客户端半由 tsdown 编译到 `lib/client.js`。

---

## TS 为主（全量 TypeScript）

```
dsh-<plugin-name>/
├─ src/
│  ├─ index.ts                   ← 宿主入口
│  ├─ <module-a>.ts              ← 核心逻辑模块
│  ├─ <module-b>.ts
│  └─ client/
│     ├─ index.ts                ← 客户端入口
│     ├─ locales.ts              ← 多语言字典
│     └─ <component>.tsx         ← React 组件
│
├─ lib/                          ← tsc + tsdown 全量构建产物
│  ├─ index.js                   ← tsc → ESM node
│  ├─ index.d.ts                 ← 类型声明
│  ├─ client.js                  ← tsdown → CJS browser bundle
│  └─ client.js.map
│
├─ assets/                       ← 市场展示图片
│  └─ .gitkeep
│
├─ cordis.patch.yml
├─ dsh.plugin.json
├─ package.json
├─ tsconfig.json                 ← 全量配置
├─ tsconfig.build.json           ← 构建专用（排除测试）
├─ tsdown.config.ts
├─ eslint.config.js
├─ screenshots.json              ← 市场展示图片清单（awesome-dsh-plugin 卡片用）
├─ README.md (四语)
├─ CHANGELOG.md (四语)
└─ LICENSE
```

**特点**：全部 `.ts/.tsx`，tsc 编译宿主半、tsdown 编译客户端半，npm 发布 `lib/`。

---

## 关键文件说明

| 文件 | 作用 |
|---|---|
| `package.json` | 名称 / 版本 / peerDeps / engines / dsh.client.inject |
| `dsh.plugin.json` | DSH 发现清单（id / 版本 / 引擎约束 / 客户端入口） |
| `cordis.patch.yml` | cordis bundle patch，声明插件身份 |
| `tsdown.config.ts` | 客户端 browser bundle（CJS + `__ModuleLoader__` 闭包工厂） |
| `src/client/index.ts` | 客户端入口（注册 slots / locale / settings） |
| `src/index.ts` 或 `.js` | 宿主入口（HTTP 路由 / cordis 服务） |
| `lib/` | 构建产物目录（宿主 + 客户端 bundle） |
| `screenshots.json` | awesome-dsh-plugin 市场卡片展示图片清单（引用 `assets/` 下的截图） |
| `assets/` | 市场展示图片存放目录（被 `screenshots.json` 引用） |
