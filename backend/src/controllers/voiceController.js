// CampusDine Controller: voiceController
const VoiceAssistantService = require("../services/voiceAssistantService");

const voiceController = {
  processSpeechCommand: (req, res) => {
    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: "Transcript text is required" });
    }

    const action = VoiceAssistantService.parseCommand(transcript);
    return res.json({
      success: true,
      transcript,
      action
    });
  }
};

module.exports = voiceController;
