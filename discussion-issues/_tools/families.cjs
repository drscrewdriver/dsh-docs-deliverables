#!/usr/bin/env node
/**
 * Shared problem-family rules.
 *
 * Single source of truth for the REGEX classifier, consumed by:
 *   - trend-analysis.cjs   (whole-corpus regex trend)
 *   - llm-trend-report.cjs (regex-vs-LLM agreement comparison)
 *
 * Keep these ids in sync with TAXONOMY in llm-classify.cjs so the two
 * classifiers remain comparable.
 */

const FAMILIES = [
  { id: 'session-migration', name: '会话格式迁移失败', kw: [/v0[→-]?to[→-]?v1|v1[→-]?to[→-]?v2|v2[→-]?to[→-]?v3/i, /v0→v1|v1→v2|v2→v3/, /session-format/i, /legacyInterruptedTurnRestart/i, /SessionFormatUnsupported/i, /(会话|session|历史).{0,20}(迁移|migration)/i, /(迁移|migration).{0,20}(会话|session)/i] },
  { id: 'session-history-unreadable', name: '升级后历史会话无法加载', kw: [/历史.*无法加载|无法加载.*历史|历史加载失败|history.*(fail|unavailable|load)/i, /session.*unreadable|unreadable.*session/i, /会话.*永久.*(打不开|不可用|无法)/i, /打不开.*会话|会话.*打不开/i, /Failed to load history/i, /cannot safely transform/i, /unknown to this harness/i] },
  { id: 'fork-inbox', name: 'Fork 继承父会话队列', kw: [/session\.fork/i, /(fork|分叉).{0,40}(inbox|队列|排队|已入队|继承|重跑|重放)/i, /(inbox|队列|排队|已入队).{0,40}(fork|分叉|继承)/i, /pending inbox/i, /fork.{0,30}(inherit|leak|replay)/i] },
  { id: 'windows-reveal', name: 'Windows 资源管理器定位失败', kw: [/Show in File Explorer/i, /reveal.*(Explorer|file manager|native)/i, /revealNativePath/i, /资源管理器|文件管理器/] },
  { id: 'web-startup-perf', name: 'dsh web 启动性能退化', kw: [/启动.*(慢|2\.7s|17s|18s)|startup.*(slow|perf)/i, /client-modules/i, /全量重(建|组)/, /命令列表洪泛|commands\/list/i, /Flood Pins CPU/i, /启动.*(约|耗时)/] },
  { id: 'client-bundle-stale', name: 'client bundle 陈旧失效', kw: [/client combo/i, /client bundle|bundle.*revision/i, /hard refresh|硬刷新|强制刷新/i, /Failed to load plugins/i, /did not activate|loaded without registering/i] },
  { id: 'persona-preset-break', name: 'persona/preset 字段重命名破坏', kw: [/persona.*(config\.text|prefix|rename|重命名)/i, /(config\.text|text.*prefix).*(persona|preset)/i, /agent-preset\/invalid|preset.*failed to mou/i, /preset "(code|cute-deepseek|[a-z-]+)" (not found|failed)/i, /(预设|preset).{0,15}(无法|失效|加载错误|创建新会话)/i, /(重命名|rename).{0,20}(字段|field).{0,20}(preset|persona)/i] },
  { id: 'malformed-toolcall', name: '畸形 tool-call 致会话不可恢复', kw: [/tool.?call.*(empty|空|畸形|malformed|missing)/i, /空 id|empty.*id/i, /tool_call_id/i, /unknown tool/i, /dangling.*tool_calls|悬空 tool_calls/i, /400 INVALID_REQUEST|missing field/i] },
  { id: 'reasoning-loop', name: '推理退化循环 / 空响应', kw: [/reasoning.*(loop|退化|循环)/i, /思考.*(退化|循环|死循环)/i, /EMPTY_RESPONSE|empty response/i, /zero.*output|零产出/i, /runaway.*(arguments|tool)/i] },
  { id: 'sandbox-windows', name: 'Windows 沙箱/TLS/代理', kw: [/schannel|TLS.*(fail|失败)/i, /sandbox.*(windows|Windows)|Windows.*sandbox/i, /proxy.*(variable|env)|代理变量/i, /sandbox_permissions|沙箱.*(失败|拒绝)/i, /\bpwsh\b|PowerShell/i] },
  { id: 'composer-ime', name: 'Composer 输入法/翻译干扰', kw: [/\bIME\b/, /输入法/, /composer.*(translat|break)/i, /\bLexical\b/, /browser translation|浏览器翻译/, /中文输入/] },
  { id: 'web-process-death', name: 'dsh web 进程静默死亡', kw: [/silent.*(process )?death|静默.*(死亡|退出|空转)/i, /0xC0000409/i, /\bPM2\b/, /import\.meta\.main/i, /heap.*(OOM|limit)|JavaScript heap out of memory/i, /process.*(crash|exit)/i] },
  { id: 'npm-install-build', name: 'npm 安装/构建失败', kw: [/fs-ext|node-addon-system/i, /pnpm.*(install|build).*(fail|报错|失败)/i, /npx.*(fail|静默|退出|卡死)/i, /Cannot find module/i, /node-gyp|MSVC/i, /node_modules.*shadow/i, /Node(\.js)?\s*<\s*24|Node 2[0-3]/i] },
  { id: 'tool-visibility', name: '工具/提示词节丢失', kw: [/loses.{0,20}(native )?tools/i, /工具.{0,10}丢失/, /prompt.{0,10}section/i, /提示词.{0,6}(注入顺序|消失|丢失)/, /dynamic.{0,20}tool.{0,20}(load|register|visible)/i, /tool.{0,20}(registration|registry).{0,20}(lost|missing|dropped)/i] },
];

// Legacy families carried over from the pre-#5886 baseline era, so the trend
// shows how the OLD dominant issues fared against the new ones.
const LEGACY_FAMILIES = [
  { id: 'legacy-session-corruption', name: '会话日志损坏（seq gap / 并发写）', kw: [/seq\s*gap/i, /corrupt session/i, /会话日志损坏/, /committed region/i, /concurrent writers/i, /多进程并发写/] },
  { id: 'legacy-sandbox-escalation', name: '沙箱同模式提权被拒', kw: [/not strictly wider/i, /same-mode.*escalation/i, /同级.*升级|同模式.*提权/i, /sandbox escalation/i] },
  { id: 'legacy-plugin-load-crash', name: '插件加载失败拖垮启动', kw: [/Failed to load plugins/i, /one.*plugin.*(takes down|abort)/i, /插件.*加载失败.*整个/i, /整个应用无法启动/i] },
  { id: 'legacy-auth-lan', name: 'Web 鉴权 / 局域网访问', kw: [/authentication required/i, /一次性 token|one-time token/i, /--host 0\.0\.0\.0|绑定.*0\.0\.0\.0/i, /局域网|LAN|trusted-host/i] },
  { id: 'legacy-context-compaction', name: '上下文压缩失效', kw: [/compaction|compact/i, /上下文.*压缩|压缩.*失败/i, /context.*overflow/i, /imageRequestPricing/i] },
  { id: 'legacy-token-auth-pwa', name: 'PWA / 移动端 / 主题', kw: [/PWA/i, /移动端|mobile/i, /RTL/i, /locale|语言包|翻译/i, /theme|皮肤|主题/i] },
];

const ALL = [...FAMILIES, ...LEGACY_FAMILIES];

/** Multi-label regex match. Returns array of family ids. */
function matchFamilies(text, fams = ALL) {
  const hits = [];
  for (const f of fams) {
    for (const k of f.kw) {
      if (k.test(text)) { hits.push(f.id); break; }
    }
  }
  return hits;
}

/** Build the searchable text for one cached discussion record. */
function docText(d) {
  return `${d.title || ''}\n${(d.body || '').slice(0, 3000)}`;
}

module.exports = { FAMILIES, LEGACY_FAMILIES, ALL, matchFamilies, docText };
