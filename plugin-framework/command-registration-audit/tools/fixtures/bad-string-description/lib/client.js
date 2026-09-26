// FIXTURE: reproduces dsh-free-search@0.4.24 exactly.
// `description` is a STRING; ui-commands later runs contribution.description()
// -> TypeError: contribution.description is not a function.
window.__ModuleLoader__.load({
  id: "bad-string-description",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    let react = require("react");
    let react_jsx_runtime = require("react/jsx-runtime");

    const inject = ["slots", "commandUi"];

    function apply(ctx) {
      ctx.slots.inject("settings.plugin.item", () =>
        ctx.slots.register(
          { name: "settings.plugin.item", key: "free-search", id: "bad-string-description", order: 120 },
          () => react_jsx_runtime.jsx("div", { children: "config" })
        )
      );
      ctx.inject(["commandUi"], (sctx) => {
        const command = sctx.get("commandUi");
        sctx.effect(() => {
          const dispose = command.register({
            name: "free-search-engine",
            description: "切换搜索引擎 / Switch web search engine",
            available: () => true,
            ui: {
              kind: "popupSelect",
              options: async () => [
                { id: "bing", label: "Bing · 免费" },
                { id: "exa", label: "Exa · API Key" },
              ],
              onSelect: async (option) => {
                void option;
              },
            },
          });
          return dispose;
        }, "bad-string-description: /free-search-engine command");
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
