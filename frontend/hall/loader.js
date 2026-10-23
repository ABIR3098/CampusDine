// Loads the Hall frontend files listed in files.js, compiles the JSX in the browser (Babel is already
// on the page for campusdine.html) and runs them. core.jsx publishes window.HallApp when it is ready.
(function () {
  window.Hall = window.Hall || {
    tabs: [],
    // a feature file calls Hall.register({ key, label, order, roles, component }) to add a tab
    register(tab) {
      this.tabs.push(tab);
      this.tabs.sort((a, b) => (a.order || 99) - (b.order || 99));
    },
  };

  const files = window.HALL_FILES || [];
  Promise.all(files.map((f) =>
    fetch("/hall/" + f, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error("Could not load hall/" + f);
      return r.text();
    }).then((text) => "// ---- " + f + "\n" + text)
  ))
    .then((parts) => {
      const code = Babel.transform(parts.join("\n"), { presets: ["react"] }).code;
      new Function("React", "Hall", code)(window.React, window.Hall);
    })
    .catch((e) => {
      console.error("Hall failed to load:", e);
      window.HallLoadError = (e && e.message) || String(e);
    });
})();
