// Dynamic loader for CampusDine modular components
(function () {
  window.CDComponents = window.CDComponents || {};

  const files = window.CD_COMPONENT_FILES || [];
  Promise.all(files.map((f) =>
    fetch("/components/" + f, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error("Could not load components/" + f);
      return r.text();
    }).then((text) => "// ---- " + f + "\n" + text)
  ))
    .then((parts) => {
      if (!window.Babel) return;
      const code = Babel.transform(parts.join("\n"), { presets: ["react"] }).code;
      new Function("React", "CDComponents", code)(window.React, window.CDComponents);
      window.dispatchEvent(new CustomEvent("cd-components-ready"));
    })
    .catch((e) => {
      console.warn("CDComponents loader notice:", e.message || e);
    });
})();
