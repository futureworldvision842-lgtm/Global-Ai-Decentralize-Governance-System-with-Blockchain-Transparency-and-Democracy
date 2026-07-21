// Firebase Cloud Function: generateCustomToken.js
// Verifies user OTP check from Firebase Auth and issues a Custom JWT for Web3Auth wallet generation.

const functions = require('firebase-functions/v1');
const {getApps, initializeApp} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');

if (getApps().length === 0) {
  initializeApp();
}

/**
 * HTTP Cloud Function to generate a custom JWT for Web3Auth.
 * Expects a Firebase ID token in the Authorization header.
 */
exports.generateCustomToken = functions.https.onRequest(async (req, res) => {
  // CORS configuration
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // 1. Verify the Firebase ID Token
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const phoneNumber = decodedToken.phone_number || '';

    // 2. Add custom claims for Web3Auth
    const additionalClaims = {
      phone: phoneNumber,
      provider: 'firebase-otp',
      wallet_tier: 1
    };

    // 3. Generate the Firebase Custom Token
    const customToken = await getAuth().createCustomToken(uid, additionalClaims);

    // 4. Return the custom token to the client
    return res.status(200).json({ token: customToken, uid: uid });
  } catch (error) {
    console.error('Error verifying ID token or creating custom token:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});
