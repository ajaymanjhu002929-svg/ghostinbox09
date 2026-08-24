const express = require("express");

const authMiddleware =
  require("../middleware/authMiddleware");

const {
  sendMessage,
  getMessages,
  markMessageAsRead,
  markAllMessagesAsRead,
  deleteMessage,
} =
  require("../controllers/message.controller");

const router =
  express.Router();


// ==========================================
// SEND
// ==========================================

router.post(
  "/",
  authMiddleware,
  sendMessage
);


// ==========================================
// GET CHAT
// ==========================================

router.get(
  "/:connectionId",
  authMiddleware,
  getMessages
);


// ==========================================
// READ ONE
// ==========================================

router.patch(
  "/:messageId/read",
  authMiddleware,
  markMessageAsRead
);


// ==========================================
// READ ALL
// ==========================================

router.patch(
  "/connection/:connectionId/read-all",
  authMiddleware,
  markAllMessagesAsRead
);


// ==========================================
// DELETE
// ==========================================

router.delete(
  "/:messageId",
  authMiddleware,
  deleteMessage
);


module.exports = router;