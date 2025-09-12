# Firebase Admin SDK Setup

## Important: Service Account Security

The Firebase service account JSON file contains sensitive credentials and should **NEVER** be committed to version control.

## Setup Instructions

1. **Store the service account file securely**
   - Keep the `nfc-profile-card-firebase-adminsdk-fbsvc-832eaa1a80.json` file in a secure location outside the repository
   - Or store it locally but ensure it's in .gitignore

2. **For local development**
   - Place the service account file in the project root
   - The file is already added to .gitignore to prevent accidental commits

3. **For production deployment (Vercel)**
   - Convert the service account JSON to a base64 string:
     ```bash
     base64 -i nfc-profile-card-firebase-adminsdk-fbsvc-832eaa1a80.json | tr -d '\n'
     ```
   - Add the base64 string as an environment variable in Vercel:
     - Variable name: `FIREBASE_ADMIN_SDK_BASE64`
   - In your application code, decode it:
     ```javascript
     const serviceAccount = JSON.parse(
       Buffer.from(process.env.FIREBASE_ADMIN_SDK_BASE64, 'base64').toString()
     );
     ```

4. **Alternative: Use individual environment variables**
   - Extract key values from the JSON and store them separately:
     - `FIREBASE_PROJECT_ID`
     - `FIREBASE_PRIVATE_KEY`
     - `FIREBASE_CLIENT_EMAIL`
   - Reference these in your Firebase admin initialization

## Security Best Practices

- Never commit service account files to Git
- Rotate service account keys periodically
- Use least-privilege access for service accounts
- Monitor service account usage in Firebase Console