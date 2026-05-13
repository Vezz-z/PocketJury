// ==============================================================================
// PocketJury Constants
// ==============================================================================

export const APP_NAME = "PocketJury";
export const APP_VERSION = "1.0.0";

// ---- Rate Limits ----
export const RATE_LIMITS = {
  AUTH: { points: 5, duration: 60 },        // 5 per minute per IP
  REGISTER: { points: 5, duration: 3600 },  // 5 per hour per IP
  QUERY: { points: 10, duration: 60 },      // 10 per minute per user
  GENERAL: { points: 100, duration: 60 },   // 100 per minute per user
  ADMIN: { points: 50, duration: 60 },      // 50 per minute per user
  FORGOT_PASSWORD: { points: 3, duration: 3600 }, // 3 per hour
  OTP_REQUEST: { points: 5, duration: 3600 },      // 5 per hour per email
  MAGIC_LINK_REQUEST: { points: 5, duration: 3600 }, // 5 per hour per email
} as const;

// ---- Auth ----
export const AUTH = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  IP_BLOCK_THRESHOLD: 10,
  IP_BLOCK_DURATION_HOURS: 1,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  QUERY_MAX_LENGTH: 2000,
} as const;

// ---- OTP Configuration ----
export const OTP = {
  TTL_SECONDS: 600,       // 10 minutes
  MAX_ATTEMPTS: 5,
  CODE_LENGTH: 6,
} as const;

// ---- Supported Languages ----
export const SUPPORTED_LANGUAGES = [
  { code: "en", nameEnglish: "English", nameNative: "English", script: "Latin", direction: "LTR" },
  { code: "hi", nameEnglish: "Hindi", nameNative: "हिन्दी", script: "Devanagari", direction: "LTR" },
  { code: "ta", nameEnglish: "Tamil", nameNative: "தமிழ்", script: "Tamil", direction: "LTR" },
  { code: "bn", nameEnglish: "Bengali", nameNative: "বাংলা", script: "Bengali", direction: "LTR" },
] as const;

export const DEFAULT_LANGUAGE = "en";

// ---- Disclaimers per Language ----
export const DISCLAIMERS: Record<string, string> = {
  en: "This information is for educational purposes only and does not constitute legal advice. Please consult a qualified lawyer or your District Legal Services Authority (Helpline: 15100) for formal guidance.",
  hi: "यह जानकारी केवल शैक्षिक उद्देश्यों के लिए है और यह कानूनी सलाह नहीं है। कृपया औपचारिक मार्गदर्शन के लिए किसी योग्य वकील या अपने जिला विधिक सेवा प्राधिकरण (हेल्पलाइन: 15100) से परामर्श करें।",
  ta: "இந்தத் தகவல் கல்வி நோக்கங்களுக்காக மட்டுமே, சட்ட ஆலோசனை அல்ல. முறையான வழிகாட்டுதலுக்கு ஒரு தகுதியான வழக்கறிஞர் அல்லது உங்கள் மாவட்ட சட்ட சேவைகள் ஆணையத்தை (உதவி எண்: 15100) தொடர்பு கொள்ளவும்.",
  bn: "এই তথ্য শুধুমাত্র শিক্ষামূলক উদ্দেশ্যে এবং আইনি পরামর্শ নয়। আনুষ্ঠানিক নির্দেশনার জন্য একজন যোগ্য আইনজীবী বা আপনার জেলা আইনি সেবা কর্তৃপক্ষ (হেল্পলাইন: 15100) এর সাথে পরামর্শ করুন।",
};

// ---- Welcome Messages per Language ----
export const WELCOME_MESSAGES: Record<string, string> = {
  en: "Welcome citizen. How may I help you today?",
  hi: "नागरिक, आपका स्वागत है। आज मैं आपकी कैसे सहायता कर सकता हूँ?",
  ta: "குடிமகனே, வரவேற்கிறோம். இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?",
  bn: "নাগরিক, স্বাগতম। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
};

// ---- National Helplines ----
export const HELPLINES = [
  { name: "NALSA Legal Aid", number: "15100", category: "LEGAL_AID", description: "Free legal aid helpline by National Legal Services Authority" },
  { name: "Women Helpline", number: "181", category: "WOMEN", description: "Women in distress helpline" },
  { name: "Emergency", number: "112", category: "EMERGENCY", description: "Unified emergency number (police, fire, ambulance)" },
  { name: "Police", number: "100", category: "EMERGENCY", description: "Police emergency" },
  { name: "Child Helpline", number: "1098", category: "CHILD", description: "CHILDLINE for children in distress" },
  { name: "Senior Citizens", number: "14567", category: "SENIOR", description: "Elder abuse helpline" },
  { name: "Cyber Crime", number: "1930", category: "CYBERCRIME", description: "National cyber crime reporting helpline" },
  { name: "SC/ST Helpline", number: "14566", category: "SC_ST", description: "Atrocities against SC/ST helpline" },
  { name: "Anti-Human Trafficking", number: "1800-419-8588", category: "TRAFFICKING", description: "Anti-human trafficking helpline (toll-free)" },
] as const;

// ---- Pagination ----
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  CHAT_HISTORY_LIMIT: 50,
  MESSAGE_LIMIT: 50,
} as const;

// ---- RAG Pipeline ----
export const RAG = {
  MAX_QUERY_TOKENS: 512,
  MAX_CONTEXT_TOKENS: 4000,
  MAX_RESPONSE_TOKENS: 2048,
  RETRIEVAL_TOP_K: 10,
  FINAL_TOP_K: 5,
  SIMILARITY_THRESHOLD: 0.5,
  CHAT_HISTORY_WINDOW: 5,
  LLM_TEMPERATURE: 0.1,
  LLM_TOP_P: 0.9,
  CHUNK_SIZE_MIN: 200,
  CHUNK_SIZE_MAX: 1000,
  CHUNK_OVERLAP: 100,
  RRF_K: 60,
} as const;

// ---- Cache TTL (seconds) ----
export const CACHE_TTL = {
  HELPLINES: 86400,         // 24 hours
  DLSA: 86400,              // 24 hours
  LEGAL_QUERY: 3600,        // 1 hour
  LANGUAGE_LIST: 86400,     // 24 hours
  USER_SESSION: 900,        // 15 minutes
  REFRESH_TOKEN: 604800,    // 7 days
} as const;

// ---- Data Retention ----
export const DATA_RETENTION = {
  CHAT_HISTORY_DAYS: 90,
  AUDIT_LOG_DAYS: 365,
  DELETED_USER_PURGE_DAYS: 30,
  BACKUP_RETENTION_DAYS: 30,
  BACKUP_GLACIER_DAYS: 90,
} as const;

// ---- Indian States and Union Territories ----
export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
] as const;
