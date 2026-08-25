const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const User = require("../models/User");


// ==========================================
// GENERATE UNIQUE USERNAME
// ==========================================

const generateUniqueUsername = async (displayName, email) => {
  // Clean Google display name
  let baseUsername = (displayName || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");

  // If Google name is empty, use email name
  if (!baseUsername) {
    baseUsername = (email || "user")
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  // Minimum 3 characters
  if (baseUsername.length < 3) {
    baseUsername = "user" + baseUsername;
  }

  // Maximum 24 characters so numbers can be added
  baseUsername = baseUsername.substring(0, 24);

  let username = baseUsername;
  let counter = 1;

  // Check if username already exists
  while (await User.findOne({ username })) {
    username = `${baseUsername}${counter}`;
    counter++;
  }

  return username;
};


// ==========================================
// GOOGLE STRATEGY
// ==========================================

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;

        const email = profile.emails?.[0]?.value
          ?.toLowerCase()
          .trim();

        const displayName = profile.displayName || "";

        const photo = profile.photos?.[0]?.value || "";


        // ==========================================
        // 1. CHECK GOOGLE ID
        // ==========================================

        let user = await User.findOne({
          googleId,
        });

        if (user) {
          return done(null, user);
        }


        // ==========================================
        // 2. CHECK EMAIL
        // ==========================================

        if (email) {
          user = await User.findOne({
            email,
          });

          if (user) {
            // Existing account - connect Google account
            user.googleId = googleId;

            if (!user.photo && photo) {
              user.photo = photo;
            }

            await user.save();

            return done(null, user);
          }
        }


        // ==========================================
        // 3. CREATE UNIQUE USERNAME
        // ==========================================

        const username = await generateUniqueUsername(
          displayName,
          email
        );


        // ==========================================
        // 4. CREATE NEW USER
        // ==========================================

        user = await User.create({
          googleId,
          email,
          username,
          photo,
          isProfileComplete: false,
        });


        return done(null, user);

      } catch (error) {
        console.error(
          "Google authentication error:",
          error
        );

        return done(error, null);
      }
    }
  )
);


module.exports = passport;