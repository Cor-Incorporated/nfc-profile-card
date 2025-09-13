const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Webhook } = require('svix');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Helper function to create a user document
async function createUserDocument(userData) {
  const userRef = db.collection('users').doc(userData.uid);
  
  const userDoc = {
    uid: userData.uid,
    email: userData.email,
    username: userData.username || userData.email.split('@')[0],
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    profile: {
      name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email.split('@')[0],
      links: [],
    },
    cards: [],
    subscription: {
      plan: 'free',
    },
  };

  await userRef.set(userDoc);
  return userDoc;
}

// Helper function to update a user document
async function updateUserDocument(uid, updates) {
  const userRef = db.collection('users').doc(uid);
  await userRef.update({
    ...updates,
    updatedAt: admin.firestore.Timestamp.now(),
  });
}

// Helper function to delete a user document
async function deleteUserDocument(uid) {
  const userRef = db.collection('users').doc(uid);
  await userRef.update({
    deleted: true,
    deletedAt: admin.firestore.Timestamp.now(),
  });
}

// Clerk Webhook endpoint
exports.clerkWebhook = functions.https.onRequest(async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  // Get the headers
  const svix_id = req.headers['svix-id'];
  const svix_timestamp = req.headers['svix-timestamp'];
  const svix_signature = req.headers['svix-signature'];

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).send('Error occurred -- no svix headers');
  }

  // Get the body
  const payload = req.body;
  const body = JSON.stringify(payload);

  // Get webhook secret from environment config
  const webhookSecret = functions.config().clerk?.webhook_secret;
  
  if (!webhookSecret) {
    console.error('Clerk webhook secret not configured');
    return res.status(500).send('Server configuration error');
  }

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(webhookSecret);

  let evt;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return res.status(400).send('Error occurred');
  }

  // Handle the webhook
  const { id } = evt.data;
  const eventType = evt.type;

  console.log(`Webhook with ID ${id} and type ${eventType}`);

  // Handle user created event
  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name, username } = evt.data;

    try {
      await createUserDocument({
        uid: id,
        email: email_addresses[0].email_address,
        username: username || undefined,
        firstName: first_name || undefined,
        lastName: last_name || undefined,
      });
      console.log(`User ${id} created in Firestore`);
    } catch (error) {
      console.error('Error creating user in Firestore:', error);
      return res.status(500).send('Error creating user');
    }
  }

  // Handle user updated event
  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, username } = evt.data;

    try {
      const updates = {};
      
      if (email_addresses && email_addresses.length > 0) {
        updates.email = email_addresses[0].email_address;
      }
      
      if (username) {
        updates.username = username;
      }
      
      if (first_name || last_name) {
        updates['profile.name'] = `${first_name || ''} ${last_name || ''}`.trim();
      }

      await updateUserDocument(id, updates);
      console.log(`User ${id} updated in Firestore`);
    } catch (error) {
      console.error('Error updating user in Firestore:', error);
      return res.status(500).send('Error updating user');
    }
  }

  // Handle user deleted event
  if (eventType === 'user.deleted') {
    try {
      await deleteUserDocument(id);
      console.log(`User ${id} marked as deleted in Firestore`);
    } catch (error) {
      console.error('Error deleting user in Firestore:', error);
      return res.status(500).send('Error deleting user');
    }
  }

  return res.status(200).send('OK');
});