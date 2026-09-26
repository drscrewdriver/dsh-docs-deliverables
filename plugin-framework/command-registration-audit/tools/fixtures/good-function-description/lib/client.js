// FIXTURE: the correct shape (mirrors dsh-free-search@0.4.25+).
window.__ModuleLoader__.load({
  id: "good-function-description",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    let react = require("react");
    let react_jsx_runtime = require("react/jsx-runtime");

    const inject = ["slots", "commandUi"];

    function apply(ctx) {
      ctx.inject(["commandUi"], (sctx) => {
        const command = sctx.get("commandUi");
        sctx.effect(() => {
          const dispose = command.register({
            name: "free-search-engine",
            description: () => "切换搜索引擎 / Switch web search engine",
            available: () => true,
            ui: {
              kind: "popupSelect",
              options: async () => [{ id: "bing", label: "Bing · 免费", active: true }],
              onSelect: async (option) => {
                void option;
                void react;
                void react_jsx_runtime;
              },
            },
          });
          return dispose;
        }, "good-function-description: /free-search-engine command");
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
