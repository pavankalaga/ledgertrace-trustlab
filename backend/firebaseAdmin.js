const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'firebase-service-account.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('[Firebase] Missing service account file at:', SERVICE_ACCOUNT_PATH);
  console.error('[Firebase] Download it from Firebase Console → Project settings → Service accounts → Generate new private key.');
  throw new Error('Firebase service account file not found');
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

console.log('[Firebase] Admin SDK initialized for project:', serviceAccount.project_id);

module.exports = admin;
