const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  sendRequest,
  getMyRequests,
  getIncomingRequests,
  acceptRequest,
  rejectRequest,
} = require("../controllers/request.controller");

const router = express.Router();


// ==========================================
// SEND REQUEST
// ==========================================

router.post(
  "/",
  authMiddleware,
  sendRequest
);


// ==========================================
// GET ALL MY REQUESTS
// ==========================================
// 
// Frontend:
// GET /api/requests
//
// Isme received + sent dono milenge.
// ==========================================

router.get(
  "/",
  authMiddleware,
  getMyRequests
);


// ==========================================
// GET INCOMING REQUESTS
// ==========================================

router.get(
  "/incoming",
  authMiddleware,
  getIncomingRequests
);


// ==========================================
// ACCEPT REQUEST
// ==========================================

router.patch(
  "/:requestId/accept",
  authMiddleware,
  acceptRequest
);


// ==========================================
// REJECT REQUEST
// ==========================================

router.patch(
  "/:requestId/reject",
  authMiddleware,
  rejectRequest
);


module.exports = router;