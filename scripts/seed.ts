import 'dotenv/config';
import { initializeApp as initializeAdminApp, getApps as getAdminApps, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, set, remove, get } from 'firebase/database';
import { faker } from '@faker-js/faker';
import { readFileSync } from 'fs';
import { join } from 'path';

// Add delay utility
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Add retry utility
async function retry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delayMs = 2000,
  backoff = 2
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries === 0 || (error?.code !== 'auth/too-many-requests' && error?.code !== 'auth/network-request-failed')) {
      throw error;
    }
    console.log(`Retrying operation after ${delayMs}ms...`);
    await delay(delayMs);
    return retry(operation, retries - 1, delayMs * backoff, backoff);
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase Admin if not already initialized
if (!getAdminApps().length) {
  const serviceAccountPath = join(process.cwd(), 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  
  initializeAdminApp({
    credential: cert(serviceAccount),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const adminAuth = getAdminAuth();

// Sample video data with real URLs
const sampleVideos = [
  {
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
  },
  {
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg',
  },
  {
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerFun.jpg',
  },
  {
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    thumbnailUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerJoyrides.jpg',
  },
  {
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    thumbnailUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerMeltdowns.jpg',
  },
];

// Generate a random avatar URL using UI Faces
const getRandomAvatarUrl = () => {
  // pravatar.cc has images from 1-70
  const randomId = Math.floor(Math.random() * 70) + 1;
  return `https://i.pravatar.cc/150?img=${randomId}`;
};

async function createLikesForVideo(videoId: string, userId: string, potentialLikerIds: string[]) {
  // Randomly select 30-70% of users to like this video
  const numLikes = Math.floor(Math.random() * (0.4 * potentialLikerIds.length)) + Math.floor(0.3 * potentialLikerIds.length);
  const shuffledLikers = [...potentialLikerIds].sort(() => 0.5 - Math.random());
  const selectedLikers = shuffledLikers.slice(0, numLikes);

  // Add likes from selected users
  for (const likerId of selectedLikers) {
    if (likerId !== userId) { // Don't let users like their own videos
      await set(ref(db, `videoLikes/${videoId}/${likerId}`), {
        createdAt: new Date().toISOString()
      });
      await set(ref(db, `userLikes/${likerId}/${videoId}`), true);
    }
  }

  // Return the number of likes created
  return selectedLikers.length;
}

async function createCommentsForVideo(videoId: string, userId: string, potentialCommenterIds: string[]) {
  // Randomly select 10-30% of users to comment on this video
  const numCommenters = Math.floor(Math.random() * (0.2 * potentialCommenterIds.length)) + Math.floor(0.1 * potentialCommenterIds.length);
  const shuffledCommenters = [...potentialCommenterIds].sort(() => 0.5 - Math.random());
  const selectedCommenters = shuffledCommenters.slice(0, numCommenters);
  
  const comments = [];
  
  // Each selected user makes 1-3 comments
  for (const commenterId of selectedCommenters) {
    if (commenterId !== userId) { // Don't let users comment on their own videos
      const numComments = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < numComments; i++) {
        const commentId = faker.string.uuid();
        const comment = {
          id: commentId,
          text: faker.lorem.sentence(),
          userId: commenterId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await set(ref(db, `videoComments/${videoId}/${commentId}`), comment);
        await set(ref(db, `userComments/${commenterId}/${commentId}`), true);
        comments.push(comment);
      }
    }
  }

  // Return the number of comments created
  return comments.length;
}

async function createUserWithProfile(index: number, allUserIds: string[] = []) {
  const timestamp = Date.now();
  const email = `testuser${index}_${timestamp}@example.com`;
  const password = 'Test123!';

  try {
    // Add retry logic for user creation
    const userCredential = await retry(async () => {
      await delay(1000); // Add small delay between each attempt
      return createUserWithEmailAndPassword(auth, email, password);
    });
    
    const uid = userCredential.user.uid;

    // Create user profile with random avatar
    const profile = {
      name: faker.person.fullName(),
      city: faker.location.city(),
      state: faker.location.state(),
      followers: 0, // Will be updated as users follow each other
      following: 0, // Will be updated as users follow each other
      likes: faker.number.int({ min: 0, max: 50000 }),
      comments: faker.number.int({ min: 0, max: 1000 }),
      avatarUrl: getRandomAvatarUrl(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save profile to Realtime Database
    await set(ref(db, `users/${uid}/profile`), profile);

    // Create 5 videos for the user
    for (let i = 0; i < 5; i++) {
      const videoId = faker.string.uuid();
      const sampleVideo = sampleVideos[i % sampleVideos.length];
      
      // Create the video without likes/comments counts initially
      const video = {
        id: videoId,
        title: faker.lorem.sentence(),
        description: faker.lorem.paragraph(),
        videoUrl: sampleVideo.videoUrl,
        thumbnailUrl: sampleVideo.thumbnailUrl,
        userId: uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save the video
      await set(ref(db, `videos/${videoId}`), video);
      await set(ref(db, `users/${uid}/videos/${videoId}`), true);

      // Create likes and comments if there are other users
      if (allUserIds.length > 0) {
        const numLikes = await createLikesForVideo(videoId, uid, allUserIds);
        const numComments = await createCommentsForVideo(videoId, uid, allUserIds);
        
        // Update video with actual counts
        await set(ref(db, `videos/${videoId}/likes`), numLikes);
        await set(ref(db, `videos/${videoId}/comments`), numComments);
      }
    }

    // Follow random users if there are any available
    if (allUserIds.length > 0) {
      const numToFollow = Math.min(10, allUserIds.length);
      const shuffledUsers = [...allUserIds].sort(() => 0.5 - Math.random());
      const usersToFollow = shuffledUsers.slice(0, numToFollow);

      for (const targetUid of usersToFollow) {
        // Create follow relationship
        await set(ref(db, `follows/${uid}/${targetUid}`), true);
        
        // Update following count for current user
        await set(ref(db, `users/${uid}/profile/following`), numToFollow);
        
        // Update followers count for target user
        const targetUserRef = ref(db, `users/${targetUid}/profile/followers`);
        const targetUserSnapshot = await get(targetUserRef);
        const currentFollowers = targetUserSnapshot.val() || 0;
        await set(targetUserRef, currentFollowers + 1);
      }
    }

    console.log(`Created user ${index + 1} with profile, 5 videos, and following relationships`);
    return uid;
  } catch (error) {
    console.error(`Error creating user ${index + 1}:`, error);
    return null;
  }
}

async function clearDatabase() {
  console.log('Clearing existing database...');
  try {
    // Clear Realtime Database
    await remove(ref(db, 'users'));
    await remove(ref(db, 'videos'));
    await remove(ref(db, 'follows'));
    console.log('Database cleared successfully');

    // Clear Authentication users
    console.log('Clearing authentication users...');
    const listUsersResult = await adminAuth.listUsers();
    const users = listUsersResult.users;
    
    if (users.length > 0) {
      const uids = users.map(user => user.uid);
      await adminAuth.deleteUsers(uids);
      console.log(`Deleted ${users.length} authentication users`);
    } else {
      console.log('No authentication users to delete');
    }
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
}

async function createAdamAccount() {
  console.log('Creating Adam\'s account...');
  try {
    // Add retry logic for Adam's account creation
    const userCredential = await retry(async () => {
      return createUserWithEmailAndPassword(auth, 'adamjweil@gmail.com', 'password');
    });
    
    const uid = userCredential.user.uid;

    // Create user profile
    const profile = {
      name: 'Adam Weil',
      city: 'New York',
      state: 'NY',
      followers: 0,
      following: 0,
      likes: 0,
      comments: 0,
      avatarUrl: 'https://i.pravatar.cc/150?img=1',
      bio: 'I love dogs!',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save profile to Realtime Database
    await set(ref(db, `users/${uid}/profile`), profile);

    // Create 10 videos for Adam
    for (let i = 0; i < 10; i++) {
      const videoId = faker.string.uuid();
      const sampleVideo = sampleVideos[i % sampleVideos.length];
      
      // Create the video without likes/comments counts initially
      const video = {
        id: videoId,
        title: faker.lorem.sentence(),
        description: faker.lorem.paragraph(),
        videoUrl: sampleVideo.videoUrl,
        thumbnailUrl: sampleVideo.thumbnailUrl,
        userId: uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save the video
      await set(ref(db, `videos/${videoId}`), video);
      await set(ref(db, `users/${uid}/videos/${videoId}`), true);
    }

    console.log('Adam\'s account created successfully with 10 videos');
    return uid;
  } catch (error) {
    console.error('Error creating Adam\'s account:', error);
    return null;
  }
}

async function main() {
  console.log('Starting seed process...');
  
  await clearDatabase();
  
  // Add delay before starting user creation
  await delay(1000);
  
  const adamUid = await createAdamAccount();
  if (!adamUid) {
    console.error('Failed to create Adam\'s account. Exiting...');
    process.exit(1);
  }
  
  // Add delay between Adam's account and random users
  await delay(2000);
  
  const userIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    console.log(`Creating user ${i + 1}/10...`);
    const uid = await createUserWithProfile(i, userIds);
    if (uid) {
      userIds.push(uid);
      // Add delay between user creations
      await delay(2000);
    }
  }
  
  console.log('Seeding finished');
  process.exit(0);
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
}); 