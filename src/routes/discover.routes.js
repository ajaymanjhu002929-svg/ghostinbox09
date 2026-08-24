
const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  getDiscoverUsers,
} = require("../controllers/discover.controller");

const router = express.Router();


// ==========================================
// DISCOVER USERS
// ==========================================

router.get(
  "/",
  authMiddleware,
  getDiscoverUsers
);


module.exports = router;

