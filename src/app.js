const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

// ==========================================
// ROUTES
// ==========================================

const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profile.routes");
const discoverRoutes = require("./routes/discover.routes");
const requestRoutes = require("./routes/request.routes");
const connectionRoutes = require("./routes/connection.routes");
const messageRoutes = require("./routes/message.routes");
const safetyRoutes = require("./routes/safety.routes");
const cleanupRoutes = require("./routes/cleanup.routes");
const evidenceRoutes = require("./routes/evidence.routes");

// ==========================================
// APP
// ==========================================

const app = express();

// ==========================================
// CORS
// ==========================================

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://ghostinbox009.vercel.app",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without origin
      // such as server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    credentials: true,
  })
);

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(cookieParser());

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Ghost Inbox API is running",
  });
});

// ==========================================
// AUTH
// ==========================================

app.use(
  "/api/auth",
  authRoutes
);

// ==========================================
// PROFILE
// ==========================================

app.use(
  "/api/profile",
  profileRoutes
);

// ==========================================
// DISCOVER
// ==========================================

app.use(
  "/api/discover",
  discoverRoutes
);

// ==========================================
// REQUESTS
// ==========================================

app.use(
  "/api/requests",
  requestRoutes
);

// ==========================================
// CONNECTIONS
// ==========================================

app.use(
  "/api/connections",
  connectionRoutes
);

// ==========================================
// MESSAGES
// ==========================================

app.use(
  "/api/messages",
  messageRoutes
);

// ==========================================
// SAFETY
// ==========================================

app.use(
  "/api/safety",
  safetyRoutes
);

// ==========================================
// EVIDENCE
// ==========================================

app.use(
  "/api/evidence",
  evidenceRoutes
);

// ==========================================
// CLEANUP
// ==========================================

app.use(
  "/api/cleanup",
  cleanupRoutes
);

// ==========================================
// 404
// ==========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ==========================================
// GLOBAL ERROR
// ==========================================

app.use((error, req, res, next) => {
  console.error(
    "Global error:",
    error
  );

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// ==========================================
// EXPORT
// ==========================================

module.exports = app;