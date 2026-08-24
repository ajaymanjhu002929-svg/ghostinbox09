const express = require("express");

const {
  getConnections,
  getConnectionById,
  removeConnection,
  checkConnectionStatus,
} = require("../controllers/connection.controller");

const authMiddleware =
  require("../middleware/authMiddleware");

const router =
  express.Router();


// ============================================================
// GET ALL ACTIVE CONNECTIONS
// ============================================================
//
// GET /api/connections
//

router.get(
  "/",
  authMiddleware,
  getConnections
);


// ============================================================
// CHECK CONNECTION STATUS
// ============================================================
//
// GET /api/connections/:connectionId/status
//
// IMPORTANT:
// Is route ko /:connectionId se PEHLE rakha hai.
//

router.get(
  "/:connectionId/status",
  authMiddleware,
  checkConnectionStatus
);


// ============================================================
// GET SINGLE CONNECTION
// ============================================================
//
// GET /api/connections/:connectionId
//

router.get(
  "/:connectionId",
  authMiddleware,
  getConnectionById
);


// ============================================================
// REMOVE CONNECTION
// ============================================================
//
// DELETE /api/connections/:connectionId
//

router.delete(
  "/:connectionId",
  authMiddleware,
  removeConnection
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;