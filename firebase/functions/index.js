const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Note: User document creation is now handled in the client-side AuthContext
// when users sign in with Firebase Auth for the first time.

// Example Cloud Function for future use
exports.exampleFunction = functions.https.onRequest(async (req, res) => {
  // This is a placeholder for future Cloud Functions
  res.status(200).send("Firebase Functions are ready");
});
