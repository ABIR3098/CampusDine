// CampusDine UI: LanguageSelector
// Allows toggling interface between English and Bangla
(function() {
  const { React } = window;
  if (!React) return;
  const { useState, useEffect } = React;

  function LanguageSelector({ currentLocale = "en", onLocaleChange }) {
    const [locale, setLocale] = useState(currentLocale);

    const toggleLocale = () => {
      const next = locale === "en" ? "bn" : "en";
      setLocale(next);
      try {
        localStorage.setItem("campusdine_locale", next);
      } catch (e) {}
      if (onLocaleChange) onLocaleChange(next);
    };

    return (
      <button
        onClick={toggleLocale}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          backgroundColor: "#F3F4F6",
          border: "1px solid #D1D5DB",
          borderRadius: "20px",
          fontSize: "12px",
          fontWeight: "600",
          color: "#374151",
          cursor: "pointer",
          transition: "all 0.15s ease"
        }}
        title="Change Language / ভাষা পরিবর্তন করুন"
      >
        <span>{locale === "en" ? "🇬🇧 EN" : "🇧🇩 বাংলা"}</span>
        <span style={{ fontSize: "10px", color: "#6B7280" }}>⇄</span>
      </button>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.LanguageSelector = LanguageSelector;
})();
