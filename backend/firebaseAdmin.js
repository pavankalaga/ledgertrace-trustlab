const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'firebase-service-account.json');

let initialized = false;

if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  try {
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
    console.log('[Firebase] Admin SDK initialized for project:', serviceAccount.project_id);
  } catch (e) {
    console.error('[Firebase] Failed to initialize Admin SDK:', e.message);
  }
} else {
  console.warn('[Firebase] Service account file not found at', SERVICE_ACCOUNT_PATH);
  console.warn('[Firebase] OTP login is disabled. Password login still works.');
}

module.exports = { admin, isInitialized: () => initialized };
