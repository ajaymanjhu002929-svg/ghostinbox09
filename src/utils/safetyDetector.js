// ==========================================
// SAFETY DETECTOR
// ==========================================
//
// Ye backend ka first-level safety detection layer hai.
//
// IMPORTANT:
// Abhi ye keyword/pattern based detector hai.
// Ye AI-based meaning/context detection nahi hai.
//
// Iska result next files mein use hoga:
//   message.controller.js
//   socket.js
//   safety.controller.js
//
// ==========================================


// ==========================================
// HARMFUL MESSAGE PATTERNS
// ==========================================
//
// In patterns ka purpose harmful / threatening /
// harassment / blackmail type conversation ko detect
// karna hai.
//
// "evidence", "save this chat" jaise words ko yahan
// intentionally nahi rakha gaya hai.
//
// Kyunki:
//
// "Can you save this chat?"
// "I need this as evidence."
//
// harmful message nahi hai.
// Ye alag safety/evidence action ho sakta hai.
//

const safetyPatterns = [
  // ------------------------------------------
  // THREATS
  // ------------------------------------------

  {
    category: "threat",
    keywords: [
      "threat",
      "threatening",
      "i will hurt you",
      "i'll hurt you",
      "i am going to hurt you",
      "i'm going to hurt you",
      "hurt you",
      "kill you",
      "i will kill you",
      "i'll kill you",
      "you will die",
      "you are going to die",
      "i will find you",
      "i'll find you",
      "watch your back",
      "you will regret this",
    ],
  },


  // ------------------------------------------
  // HARASSMENT
  // ------------------------------------------

  {
    category: "harassment",
    keywords: [
      "harass",
      "harassing",
      "harassment",
      "stop contacting me",
      "stop messaging me",
      "leave me alone",
      "you keep bothering me",
      "you keep disturbing me",
      "i don't want you to contact me",
    ],
  },


  // ------------------------------------------
  // BLACKMAIL
  // ------------------------------------------

  {
    category: "blackmail",
    keywords: [
      "blackmail",
      "blackmailing",
      "blackmail you",
      "i will expose you",
      "i'll expose you",
      "i will leak",
      "i'll leak",
      "leak your photos",
      "leak your photo",
      "leak your messages",
      "leak this conversation",
      "send this to everyone",
      "post this online",
    ],
  },


  // ------------------------------------------
  // ABUSE
  // ------------------------------------------

  {
    category: "abuse",
    keywords: [
      "abuse",
      "abusive",
      "verbally abuse",
      "physical abuse",
      "sexual abuse",
    ],
  },


  // ------------------------------------------
  // COERCION
  // ------------------------------------------

  {
    category: "coercion",
    keywords: [
      "do this or else",
      "you better do this",
      "if you don't",
      "if you do not",
      "or else",
      "you have no choice",
      "i will make you",
      "i'll make you",
    ],
  },


  // ------------------------------------------
  // INTIMIDATION
  // ------------------------------------------

  {
    category: "intimidation",
    keywords: [
      "i know where you live",
      "i know where you stay",
      "i know your address",
      "i know your location",
      "you can't hide from me",
      "you cannot hide from me",
      "i am watching you",
      "i'm watching you",
    ],
  },
];


// ==========================================
// TEXT NORMALIZATION
// ==========================================

const normalizeText = (text) => {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
};


// ==========================================
// DETECT SAFETY
// ==========================================
//
// Return:
//
// {
//   isHarmful: true,
//   category: "threat",
//   matchedKeyword: "hurt you"
// }
//
// OR:
//
// {
//   isHarmful: false,
//   category: null,
//   matchedKeyword: null
// }
//

const detectSafety = (text) => {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return {
      isHarmful: false,
      category: null,
      matchedKeyword: null,
    };
  }


  // ------------------------------------------
  // CHECK ALL CATEGORIES
  // ------------------------------------------

  for (const patternGroup of safetyPatterns) {
    for (const keyword of patternGroup.keywords) {
      const normalizedKeyword =
        normalizeText(keyword);

      if (
        normalizedKeyword &&
        normalizedText.includes(normalizedKeyword)
      ) {
        return {
          isHarmful: true,
          category: patternGroup.category,
          matchedKeyword: normalizedKeyword,
        };
      }
    }
  }


  // ------------------------------------------
  // NOTHING FOUND
  // ------------------------------------------

  return {
    isHarmful: false,
    category: null,
    matchedKeyword: null,
  };
};


// ==========================================
// BACKWARD COMPATIBILITY
// ==========================================
//
// Tumhare existing socket.js mein currently:
//
// const isFlagged = detectSafetyKeyword(text);
//
// use ho raha hai.
//
// Isliye is function ko remove nahi karna.
// Ye existing code ko break hone se bachayega.
//

const detectSafetyKeyword = (text) => {
  const result = detectSafety(text);

  return result.isHarmful;
};


// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  detectSafety,
  detectSafetyKeyword,
  normalizeText,
  safetyPatterns,
};