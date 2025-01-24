import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, set } from 'firebase/database';
import { faker } from '@faker-js/faker';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env') });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

async function createUserWithProfile(index: number) {
  const timestamp = Date.now();
  const email = `testuser${index}_${timestamp}@example.com`;
  const password = 'Test123!'; // Simple password for test users

  try {
    // Create Firebase auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Create user profile
    const profile = {
      name: faker.person.fullName(),
      city: faker.location.city(),
      state: faker.location.state(),
      followers: faker.number.int({ min: 0, max: 10000 }),
      following: faker.number.int({ min: 0, max: 1000 }),
      likes: faker.number.int({ min: 0, max: 50000 }),
      comments: faker.number.int({ min: 0, max: 1000 }),
      avatarUrl: '/default-avatar.png',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save profile to Realtime Database
    await set(ref(db, `users/${uid}/profile`), profile);

    // Create 10 videos for the user
    for (let i = 0; i < 10; i++) {
      const videoId = faker.string.uuid();
      const video = {
        id: videoId,
        title: faker.lorem.sentence(),
        description: faker.lorem.paragraph(),
        videoUrl: `https://storage.example.com/videos/${videoId}.mp4`,
        thumbnailUrl: '/default-thumbnail.jpg',
        likes: faker.number.int({ min: 0, max: 1000 }),
        comments: faker.number.int({ min: 0, max: 100 }),
        shares: faker.number.int({ min: 0, max: 500 }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await set(ref(db, `videos/${videoId}`), video);
      await set(ref(db, `users/${uid}/videos/${videoId}`), true);
    }

    console.log(`Created user ${index + 1} with profile and 10 videos`);
  } catch (error) {
    console.error(`Error creating user ${index + 1}:`, error);
  }
}

async function main() {
  console.log('Starting seed...');

  // Create 10 users with profiles and videos
  const promises = Array.from({ length: 10 }, (_, i) => createUserWithProfile(i));
  await Promise.all(promises);

  console.log('Seeding finished');
  process.exit(0);
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
}); 