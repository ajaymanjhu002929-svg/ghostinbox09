const express =
  require("express");

const {
  saveEvidence,
  getMyEvidence,
  reportEvidence,
} =
  require(
    "../controllers/evidence.controller"
  );

const authMiddleware =
  require(
    "../middleware/authMiddleware"
  );

const router =
  express.Router();

// ============================================================
// SAVE
// ============================================================

router.post(
  "/",
  authMiddleware,
  saveEvidence
);

// ============================================================
// GET
// ============================================================

router.get(
  "/",
  authMiddleware,
  getMyEvidence
);

// ============================================================
// REPORT
// ============================================================

router.post(
  "/report",
  authMiddleware,
  reportEvidence
);

module.exports =
  router;