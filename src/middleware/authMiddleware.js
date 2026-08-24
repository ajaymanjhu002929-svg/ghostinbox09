const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    // ==========================================
    // GET TOKEN FROM COOKIE
    // ==========================================

    let token = req.cookies?.token;

    // ==========================================
    // FALLBACK: AUTHORIZATION HEADER
    // ==========================================

    if (!token) {
      const authHeader =
        req.headers.authorization;

      if (
        authHeader &&
        authHeader.startsWith("Bearer ")
      ) {
        token =
          authHeader.substring(7);
      }
    }

    // ==========================================
    // TOKEN NOT FOUND
    // ==========================================

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // ==========================================
    // VERIFY JWT
    // ==========================================

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    // ==========================================
    // SAVE USER INFORMATION
    // ==========================================

    req.user = decoded;

    req.userId =
      decoded.userId ||
      decoded.id ||
      decoded._id;

    // ==========================================
    // USER ID CHECK
    // ==========================================

    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
    }

    next();

  } catch (error) {
    console.error(
      "Auth middleware error:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = authMiddleware;