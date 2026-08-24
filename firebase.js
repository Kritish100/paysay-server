const { initializeApp, cert } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

// Build the credential object securely from environment variables
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // We must replace the literal '\n' text characters with actual line breaks so the crypto parser can read it
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
};

// Initialize Firebase
const app = initializeApp({
  credential: cert(serviceAccount),
});

// Export the messaging service
const messaging = getMessaging(app);
module.exports = messaging;
