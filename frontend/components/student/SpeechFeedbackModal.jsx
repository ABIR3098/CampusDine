// CampusDine UI: SpeechFeedbackModal
// Displays speech transcription, AI intent detection, and automated cart action
(function() {
  const { React } = window;
  if (!React) return;
  const { useState, useEffect } = React;

  function SpeechFeedbackModal({ isOpen, onClose, onCommandExecute }) {
    if (!isOpen) return null;

    const [isRecording, setIsRecording] = useState(true);
    const [transcript, setTranscript] = useState("দুটো চিকেন বিরিয়ানি আর একটা বোরহানি দিন");
    const [action, setAction] = useState({
      intent: "ADD_TO_CART",
      dishName: "Chicken Biryani",
      quantity: 2,
      message: "Added 2x Chicken Biryani to your cart!"
    });

    const handleConfirm = () => {
      if (onCommandExecute) onCommandExecute(action);
      alert(`✅ ${action.message}`);
      onClose();
    };

    return (
      <div style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px"
      }}>
        <div style={{
          backgroundColor: "#FFF",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "440px",
          padding: "24px",
          textAlign: "center",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)"
        }}>
          {/* Animated Mic Icon */}
          <div style={{
            width: "68px",
            height: "68px",
            borderRadius: "50%",
            backgroundColor: "#EFF6FF",
            color: "#2563EB",
            fontSize: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px auto",
            border: "2px solid #BFDBFE"
          }}>
            🎙️
          </div>

          <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#111827", fontWeight: "700" }}>
            CampusDine Voice Assistant
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#6B7280" }}>
            Listening in বাংলা & English (Web Speech API)
          </p>

          {/* Transcript Box */}
          <div style={{ backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "14px", marginBottom: "16px", textAlign: "left" }}>
            <div style={{ fontSize: "11px", color: "#9CA3AF", marginBottom: "4px" }}>Heard speech:</div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#1F2937", fontStyle: "italic" }}>
              "{transcript}"
            </div>
          </div>

          {/* Detected Action Badge */}
          <div style={{ backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "10px", padding: "12px", marginBottom: "20px" }}>
            <div style={{ fontSize: "12px", color: "#065F46", fontWeight: "700" }}>
              ACTION: {action.intent}
            </div>
            <div style={{ fontSize: "13px", color: "#047857", marginTop: "2px" }}>
              {action.message}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button
              onClick={onClose}
              style={{ padding: "9px 18px", backgroundColor: "#F3F4F6", border: "1px solid #D1D5DB", borderRadius: "8px", cursor: "pointer", fontWeight: "500" }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              style={{ padding: "9px 22px", backgroundColor: "#16A34A", color: "#FFF", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
            >
              Apply to Cart ✓
            </button>
          </div>
        </div>
      </div>
    );
  }

  window.CDComponents = window.CDComponents || {};
  window.CDComponents.SpeechFeedbackModal = SpeechFeedbackModal;
})();
