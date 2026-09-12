# dsh-plugin-template

> **Template for a DSH Cordis bundle plugin — TypeScript-first, cross-version compatible.**

A minimal but complete DSH plugin scaffold following the [plugin-framework](../) standards. Use this as a starting point for your own plugin.

## Features

- **TypeScript-first** — full `.ts` source, `tsc` + custom bundle build
- **Cross-version compatible** — dual API for settings (`installSection` / `register` fallback)
- **Cordis bundle** — `dsh.bundle.patch` + `cordis.patch.yml` for profile loading
- **Client module** — `__ModuleLoader__` contract for browser half
- **Standard structure** — matches awesome-dsh-plugin review requirements

## File Structure

```
dsh-plugin-template/
├─ src/
│  ├─ index.ts                   ← Node half: loader entry, installs nothing
│  └─ client/
│     └─ index.ts                ← Browser half: Cordis entry + patterns
├─ scripts/
│  └─ build-client.mjs           ← TypeScript → __ModuleLoader__ bundle
├─ lib/                          ← build output (gitignored)
├─ tests/                        ← unit tests
├─ assets/                       ← marketplace screenshots (placeholder)
├─ cordis.patch.yml              ← cordis bundle patch (pure insert)
├─ dsh.plugin.json               ← DSH discovery manifest
├─ package.json                  ← npm metadata + dsh config
├─ tsconfig.json                 ← TypeScript base config
├─ tsconfig.build.json           ← build-specific config
├─ tsdown.config.ts              ← optional tsdown client bundle config
├─ screenshots.json              ← marketplace screenshot manifest
├─ README.md
├─ LICENSE
└─ .gitignore
```

## Install

```sh
# From npm (recommended)
dsh plugin --profile web add dsh-plugin-template

# From local path (development)
dsh plugin --profile web add /path/to/dsh-plugin-template
```

Restart the profile, then verify:

```sh
dsh web --dump-config | Select-String dsh-plugin-template
```

## Development

```sh
npm install
npm run typecheck   # TypeScript type check
npm run build       # Build lib/
npm test            # Run test suite
```

## Version Compatibility

| DSH Version | Compatible | Notes |
|---|---|---|
| ≥ 0.1.2-alpha.1 | ✅ | Use `dsh plugin add dsh-plugin-template` |
| ≤ 0.1.1-rc.2 | ⚠️ | May need client package name adjustment |

> See [distribution-strategy.md](distribution-strategy.md) for multi-version support.

## Submitting to awesome-dsh-plugin

1. Ensure `dsh.bundle` manifest is present (B.2 in submission-guide)
2. Declare `@deepseek-ai/*` as optional `peerDependencies` (B.3)
3. Add `dsh-plugin` topic to your GitHub repo
4. Follow steps 0–7 in [submission-guide.md](submission-guide.md)

## License

MIT
