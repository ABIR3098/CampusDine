const test = require("node:test");
const assert = require("node:assert/strict");
const VoiceAssistantService = require("../src/services/voiceAssistantService");

test("VoiceAssistantService.parseCommand parses English add-to-cart commands", () => {
  const result = VoiceAssistantService.parseCommand("add 2 chicken biryani please");
  assert.equal(result.intent, "ADD_TO_CART");
  assert.equal(result.dishName, "Chicken Biryani");
  assert.equal(result.quantity, 2);
});

test("VoiceAssistantService.parseCommand parses Bangla add-to-cart commands with Bangla numbers", () => {
  const result = VoiceAssistantService.parseCommand("দুটো পরোটা দাও");
  assert.equal(result.intent, "ADD_TO_CART");
  assert.equal(result.dishName, "Paratha");
  assert.equal(result.quantity, 2);
});

test("VoiceAssistantService.parseCommand detects checkout intent", () => {
  const result = VoiceAssistantService.parseCommand("অর্ডার কনফার্ম করো");
  assert.equal(result.intent, "CHECKOUT");
});

test("VoiceAssistantService.parseCommand falls back to SEARCH_FOOD for unrecognized items", () => {
  const result = VoiceAssistantService.parseCommand("চিকেন পিজ্জা আছে কি");
  assert.equal(result.intent, "SEARCH_FOOD");
  assert.ok(result.query);
});

test("VoiceAssistantService.parseCommand handles empty transcript", () => {
  const result = VoiceAssistantService.parseCommand("");
  assert.equal(result.intent, "UNKNOWN");
});
