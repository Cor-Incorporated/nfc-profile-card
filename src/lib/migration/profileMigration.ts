import { doc, getDoc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Profile, ProfileContextType } from '@/types';

/**
 * Migrate existing profile data from the old structure to the new contextual profiles structure
 * Old: users/{uid}/profile (single document)
 * New: users/{uid}/profiles/{profileId} (subcollection)
 */
export async function migrateUserProfile(userId: string): Promise<boolean> {
  try {
    // 1. Check if user has already been migrated
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.log('User document not found');
      return false;
    }

    const userData = userDoc.data();

    // Check if already migrated
    if (userData.profileMigrated) {
      console.log('User profile already migrated');
      return true;
    }

    // 2. Retrieve existing profile data
    const oldProfileRef = doc(db, 'users', userId, 'profile', 'data');
    const oldProfileDoc = await getDoc(oldProfileRef);

    if (!oldProfileDoc.exists()) {
      console.log('No existing profile data to migrate');
      // Mark as migrated even if no data exists
      await setDoc(userRef, {
        profileMigrated: true,
        migrationDate: serverTimestamp()
      }, { merge: true });
      return true;
    }

    const oldProfileData = oldProfileDoc.data();

    // 3. Create default profile in new structure
    const defaultProfileId = 'default';
    const newProfileRef = doc(db, 'users', userId, 'profiles', defaultProfileId);

    // Prepare the migrated profile data
    const migratedProfile: any = {
      id: defaultProfileId,
      name: 'デフォルトプロファイル',
      context: 'business' as ProfileContextType,
      isActive: true,
      isDefault: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      // Preserve existing editor content
      editorContent: oldProfileData.editorContent || null,

      // Preserve background settings
      backgroundColor: oldProfileData.backgroundColor || '#ffffff',
      backgroundImage: oldProfileData.backgroundImage || null,
      backgroundGradient: oldProfileData.backgroundGradient || null,
      backgroundOpacity: oldProfileData.backgroundOpacity || 1,

      // Preserve social links
      socialLinks: oldProfileData.socialLinks || [],

      // Preserve any custom fields
      customFields: oldProfileData.customFields || {},

      // Add new profile-specific fields
      description: 'ビジネス用のデフォルトプロファイル',

      // Font settings (use existing or default)
      fontSettings: oldProfileData.fontSettings || {
        family: 'noto-sans-jp',
        size: 'medium',
        color: '#000000'
      },

      // Analytics (initialize new)
      analytics: {
        views: 0,
        clicks: 0,
        lastViewed: null
      }
    };

    // 4. Save the migrated profile
    await setDoc(newProfileRef, migratedProfile);

    // 5. Update user document to track default profile and migration status
    await setDoc(userRef, {
      defaultProfileId: defaultProfileId,
      profileMigrated: true,
      migrationDate: serverTimestamp(),
      // Preserve username and other user fields
      ...userData,
    }, { merge: true });

    console.log(`Successfully migrated profile for user ${userId}`);
    return true;

  } catch (error) {
    console.error('Error migrating user profile:', error);
    return false;
  }
}

/**
 * Check if a user needs migration
 */
export async function needsMigration(userId: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return false;
    }

    const userData = userDoc.data();

    // User needs migration if not marked as migrated
    return !userData.profileMigrated;

  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
}

/**
 * Get the active profile ID for a user
 * Returns the default profile ID if migration is needed
 */
export async function getActiveProfileId(userId: string): Promise<string> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();

    // If not migrated yet, trigger migration and return default
    if (!userData.profileMigrated) {
      const migrationSuccess = await migrateUserProfile(userId);
      if (migrationSuccess) {
        return 'default';
      }
      throw new Error('Migration failed');
    }

    // Return the user's default profile ID
    return userData.defaultProfileId || 'default';

  } catch (error) {
    console.error('Error getting active profile ID:', error);
    // Fallback to default
    return 'default';
  }
}