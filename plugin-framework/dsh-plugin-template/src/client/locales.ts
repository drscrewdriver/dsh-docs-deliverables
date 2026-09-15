/**
 * Locale dictionaries for `dsh-plugin-template`.
 *
 * `ZH` is the key-set source of truth; every other language mirrors its key
 * union via `Record<keyof typeof ZH, string>` so a missing key is a compile
 * error. The browser half registers these through `ctx.locale.register(ns, { zh, en })`.
 *
 * To ship Japanese / Korean (or any third language) as well, register the extra
 * dictionaries through the single-locale overload — `ctx.locale.register(NS, 'ja', JA)`
 * — and note that stock DSH only exposes `zh` / `en` in the Language row until a
 * language pack calls `ctx.locale.addLanguage({ id, label, fallback })`.
 * Full walkthrough: ../i18n-multilingual-guide.md
 */

export const EN = {
  'plugin-template.title': 'Plugin Template',
  'plugin-template.description': 'A cross-version compatible DSH plugin.',
  'plugin-template.enabled': 'Enable',
  'plugin-template.featureA': 'Feature A (advanced)',
  'plugin-template.featureB': 'Feature B (experimental)',
};

export const ZH = {
  'plugin-template.title': '插件模板',
  'plugin-template.description': '一个跨版本兼容的 DSH 插件。',
  'plugin-template.enabled': '启用',
  'plugin-template.featureA': '功能 A（高级）',
  'plugin-template.featureB': '功能 B（实验性）',
};

export type LocaleKey = keyof typeof EN;
export type LocaleDict = Record<LocaleKey, string>;
