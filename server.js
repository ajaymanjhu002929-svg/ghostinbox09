const http = require("http");
const dotenv = require("dotenv");

dotenv.config();

const app = require("./src/app");
const connectDB = require("./src/config/db");

const {
  initializeSocket,
} = require("./src/socket/socket");

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

const {
  Server,
} = require("socket.io");

const io = new Server(
  server,
  {
    cors: {
      origin:
        "http://localhost:5173",

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