# dsh-plugin-template

> **DSH Cordis bundle 插件模板 — TypeScript 优先，跨版本兼容。**

遵循 [plugin-framework](../) 标准的最小完整 DSH 插件脚手架。用作你自有插件的起点。

## 特性

- **TypeScript 优先** — 全 `.ts` 源码，`tsc` + 自定义 bundle 构建
- **跨版本兼容** — settings 双 API（`installSection` / `register` 回退）
- **Cordis bundle** — `dsh.bundle.patch` + `cordis.patch.yml` 用于 profile 加载
- **客户端模块** — `__ModuleLoader__` 合约用于浏览器端
- **标准结构** — 符合 awesome-dsh-plugin 审核要求

## 文件结构

```
dsh-plugin-template/
├─ src/
│  ├─ index.ts                   ← 宿主入口：安装器入口，不安装任何东西
│  └─ client/
│     └─ index.ts                ← 客户端入口：Cordis 入口 + 模式示例
├─ scripts/
│  └─ build-client.mjs           ← TypeScript → __ModuleLoader__ bundle
├─ lib/                          ← 构建产物（gitignored）
├─ tests/                        ← 单元测试
├─ assets/                       ← 市场截图（占位）
├─ cordis.patch.yml              ← cordis bundle patch（纯插入）
├─ dsh.plugin.json               ← DSH 发现清单
├─ package.json                  ← npm 元数据 + dsh 配置
├─ tsconfig.json                 ← TypeScript 基础配置
├─ tsconfig.build.json           ← 构建专用配置
├─ tsdown.config.ts              ← 可选 tsdown 客户端 bundle 配置
├─ screenshots.json              ← 市场截图清单
├─ README.md
├─ LICENSE
└─ .gitignore
```

## 安装

```sh
# 从 npm 安装（推荐）
dsh plugin --profile web add dsh-plugin-template

# 从本地路径安装（开发）
dsh plugin --profile web add /path/to/dsh-plugin-template
```

重启 profile，然后验证：

```sh
dsh web --dump-config | Select-String dsh-plugin-template
```

## 开发

```sh
npm install
npm run typecheck   # TypeScript 类型检查
npm run build       # 构建 lib/
npm test            # 运行测试套件
```

## 版本兼容

| DSH 版本 | 兼容 | 说明 |
|---|---|---|
| ≥ 0.1.2-alpha.1 | ✅ | 使用 `dsh plugin add dsh-plugin-template` |
| ≤ 0.1.1-rc.2 | ⚠️ | 可能需要调整客户端包名 |

> 多版本支持见 [distribution-strategy.md](distribution-strategy.md)

## 投稿到 awesome-dsh-plugin

1. 确保存在 `dsh.bundle` 清单（投稿指南 §B.2）
2. 将 `@deepseek-ai/*` 声明为 `optional peerDependencies`（§B.3）
3. 在 GitHub 仓库添加 `dsh-plugin` topic
4. 按 [submission-guide.md](submission-guide.md) 的步骤 0–7 操作

## 许可

MIT
