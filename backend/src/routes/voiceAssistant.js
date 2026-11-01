// CampusDine Route: Voice Assistant API
const express = require("express");
const router = express.Router();
const voiceController = require("../controllers/voiceController");

router.post("/process-command", voiceController.processSpeechCommand);

module.exports = router;
