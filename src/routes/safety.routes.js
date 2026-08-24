const express = require("express");

const {
  saveConversationAsEvidence,
  getEvidenceMessages,
  getConnectionEvidence,
  saveMessageAsEvidence,
  checkConversationEvidence,
} = require("../controllers/safety.controller");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


// ==========================================
// SAVE COMPLETE CONVERSATION AS EVIDENCE
// ==========================================
//
// Page 13:
// "Save Conversation"
//
// POST
// /api/safety/save-conversation
//

router.post(
  "/save-conversation",
  authMiddleware,
  saveConversationAsEvidence
);


// ==========================================
// GET ALL EVIDENCE
// ==========================================
//
// Evidence Collection page.
//
// GET
// /api/safety/evidence
//

router.get(
  "/evidence",
  authMiddleware,
  getEvidenceMessages
);


// ==========================================
// GET EVIDENCE OF ONE CONNECTION
// ==========================================
//
// Particular chat ki saved evidence.
//
// GET
// /api/safety/evidence/:connectionId
//

router.get(
  "/evidence/:connectionId",
  authMiddleware,
  getConnectionEvidence
);


// ==========================================
// SAVE SINGLE MESSAGE AS EVIDENCE
// ==========================================
//
// Future use / individual message save.
//
// POST
// /api/safety/message/:messageId
//

router.post(
  "/message/:messageId",
  authMiddleware,
  saveMessageAsEvidence
);


// ==========================================
// CHECK CONVERSATION EVIDENCE
// ==========================================
//
// Check karta hai ki conversation mein
// already evidence saved hai ya nahi.
//
// GET
// /api/safety/evidence/:connectionId/status
//

router.get(
  "/evidence/:connectionId/status",
  authMiddleware,
  checkConversationEvidence
);


module.exports = router;