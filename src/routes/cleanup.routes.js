const express = require("express");

const authMiddleware =
  require("../middleware/authMiddleware");

const {
  permanentlyDeleteConnection,
} =
  require("../controllers/cleanup.controller");

const router =
  express.Router();

router.delete(
  "/connection/:connectionId",
  authMiddleware,
  permanentlyDeleteConnection
);

module.exports = router;