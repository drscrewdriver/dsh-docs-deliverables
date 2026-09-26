// FIXTURE: same defect, hidden behind a constant.
// L1 static scan can only say "identifier -> statically undecidable" (WARN);
// L2 runtime probe resolves it and reports the hard ERROR.
window.__ModuleLoader__.load({
  id: "bad-const-description",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    let react = require("react");
    let react_jsx_runtime = require("react/jsx-runtime");

    const DESC = "导出会话 / Export session";

    const inject = ["commandUi"];

    function apply(ctx) {
      const command = ctx.get("commandUi");
      ctx.effect(() => {
        const dispose = command.register({
          name: "export-now",
          description: DESC,
          available: (session) => session !== void 0,
          ui: {
            kind: "action",
            run: () => {
              void react;
              void react_jsx_runtime;
            },
          },
        });
        return dispose;
      }, "bad-const-description: /export-now");
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
