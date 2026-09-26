// FIXTURE: decorate() carrying a `description`.
// CommandDecoration has no such field -> WARN (dead field + smell that
// register() was intended). Also omits `available`, which IS required -> ERROR.
window.__ModuleLoader__.load({
  id: "bad-decorate-description",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    let react = require("react");
    let react_jsx_runtime = require("react/jsx-runtime");

    const inject = ["commandUi"];

    function apply(ctx) {
      const command = ctx.get("commandUi");
      ctx.effect(() => {
        const dispose = command.decorate({
          name: "compact",
          description: "压缩以上对话内容",
          ui: {
            kind: "popupSelect",
            options: async () => [{ id: "tail", label: "Adaptive tail" }],
            onSelect: async () => {
              void react;
              void react_jsx_runtime;
            },
          },
        });
        return dispose;
      }, "bad-decorate-description: /compact");
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
