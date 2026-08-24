const http = require("http");
const dotenv = require("dotenv");

dotenv.config();

const app = require("./src/app");
const connectDB = require("./src/config/db");

const {
  initializeSocket,
} = require("./src/socket/socket");

const {
  Server,
} = require("socket.io");

// ==========================================
// PORT
// ==========================================

const PORT =
  process.env.PORT || 3000;

// ==========================================
// HTTP SERVER
// ==========================================

const server =
  http.createServer(app);

// ==========================================
// SOCKET.IO
// ==========================================

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
].filter(Boolean);

const io = new Server(
  server,
  {
    cors: {
      origin: function (
        origin,
        callback
      ) {
        if (!origin) {
          return callback(null, true);
        }

        if (
          allowedOrigins.includes(
            origin
          )
        ) {
          return callback(
            null,
            true
          );
        }

        return callback(
          new Error(
            "Socket CORS blocked"
          )
        );
      },

      credentials: true,
    },
  }
);

// ==========================================
// INITIALIZE SOCKET
// ==========================================

initializeSocket(io);

// ==========================================
// START SERVER
// ==========================================

const startServer = async () => {
  try {
    await connectDB();

    server.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `Server is running on port ${PORT}`
        );

        console.log(
          "Socket.IO server is ready"
        );
      }
    );
  } catch (error) {
    console.error(
      "Server startup error:",
      error
    );

    process.exit(1);
  }
};

startServer();