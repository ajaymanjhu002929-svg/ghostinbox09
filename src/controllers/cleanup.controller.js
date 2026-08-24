const Connection = require("../models/Connection");
const Message = require("../models/Message");


// ==========================================
// PERMANENT CLEANUP
// ==========================================
//
// Sirf tab chalega jab dono users
// connection remove kar chuke hon.
//
// ==========================================

const permanentlyDeleteConnection = async (
  req,
  res
) => {
  try {
    const userId = req.userId;
    const { connectionId } = req.params;

    const connection =
      await Connection.findOne({
        _id: connectionId,

        $or: [
          { user1: userId },
          { user2: userId },
        ],
      });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message:
          "Connection not found",
      });
    }

    // ==========================================
    // BOTH USERS MUST REMOVE
    // ==========================================

    if (
      connection.removedBy.length < 2
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Both users must remove the connection first",
      });
    }

    // ==========================================
    // DELETE TEMPORARY MESSAGES
    // ==========================================

    await Message.deleteMany({
      connection: connectionId,

      isSavedAsEvidence: false,
    });

    // ==========================================
    // DELETE CONNECTION
    // ==========================================

    await Connection.findByIdAndDelete(
      connectionId
    );

    return res.status(200).json({
      success: true,
      message:
        "Connection permanently deleted",
    });

  } catch (error) {

    console.error(
      "Permanent cleanup error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to permanently delete connection",
    });
  }
};


module.exports = {
  permanentlyDeleteConnection,
};