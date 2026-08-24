const User = require("../models/User");


// ==========================================
// DISCOVER USERS
// ==========================================

const getDiscoverUsers = async (req, res) => {
  try {
    // ==========================================
    // CURRENT USER
    // ==========================================

    const currentUser = await User.findById(req.userId);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }


    // ==========================================
    // SEARCH VALUE
    // ==========================================
    //
    // Frontend:
    //
    // /api/discover?search=k
    //
    // /api/discover?search=kh
    //
    // /api/discover?search=khushi
    //
    // ==========================================

    const search = req.query.search?.trim() || "";


    // ==========================================
    // BASE QUERY
    // ==========================================

    const query = {
      // Apne aap ko discover me mat dikhao
      _id: {
        $ne: req.userId,
      },

      // Sirf completed profiles
      isProfileComplete: true,

      // Same category ke users
      category: currentUser.category,
    };


    // ==========================================
    // USERNAME SEARCH
    // ==========================================
    //
    // search = "k"
    //
    // khushi     ✅
    // kajal      ✅
    // karan      ✅
    // ajay       ❌
    //
    // search = "kh"
    //
    // khushi     ✅
    // kajal      ❌
    //
    // search = "khu"
    //
    // khushi     ✅
    // khushi123  ✅
    // akhushi    ❌
    //
    // ==========================================

    if (search) {

      // Special regex characters escape
      // kar rahe hain.
      const escapedSearch = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      query.username = {
        $regex: `^${escapedSearch}`,
        $options: "i",
      };
    }


    // ==========================================
    // FIND USERS
    // ==========================================

    const users = await User.find(query)
      .select(
        "_id username photo gender age category about interests lookingFor qualities"
      )
      .limit(20);


    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });

  } catch (error) {

    console.error(
      "Discover users error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch discover users",
    });
  }
};


// ==========================================
// EXPORT
// ==========================================

module.exports = {
  getDiscoverUsers,
};