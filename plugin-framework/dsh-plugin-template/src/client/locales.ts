/**
 * Locale dictionaries for `dsh-plugin-template`.
 *
 * Extend with your translations. The DSH locale system reads from
 * `ctx.get('locale').translate(key)` in the browser half.
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
