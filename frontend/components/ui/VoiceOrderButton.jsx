// CampusDine UI: VoiceOrderButton
// Floating voice order button triggering speech recognition modal
(function() {
  const { React } = window;
  if (!React) return;
  const { useState } = React;

  function VoiceOrderButton({ onVoiceClick }) {
    const [isListening, setIsListening] = useState(false);

    const handleClick = () => {
      setIsListening(!isListening);
      if (onVoiceClick) onVoiceClick();
    };

    return (
      <button
        onClick={handleClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 14px",
          backgroundColor: isListening ? "#DC2626" : "#2563EB",
          color: "#FFF",
          border: "none",
          borderRadius: "20px",
          fontSize: "13px",
          fontWeight: "600",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
          transition: "all 0.2s ease"
        }}
        title="Voice Order (বাংলা বা ইংরেজিতে কথা বলে অর্ডার করুন)"
      >
        <span style={{ fontSize: "15px" }}>{isListening ? "🔴" : "🎙️"}</span>
        <span>{isListening ? "Listening..." : "Voice Order"}</span>
      </button>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.VoiceOrderButton = VoiceOrderButton;
})();
