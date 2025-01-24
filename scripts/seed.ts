import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, set, remove } from 'firebase/database';
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

    // Create 5 videos for the user using real sample videos
    for (let i = 0; i < 5; i++) {
      const videoId = faker.string.uuid();
      const sampleVideo = sampleVideos[i % sampleVideos.length];
      const video = {
        id: videoId,
        title: faker.lorem.sentence(),
        description: faker.lorem.paragraph(),
        videoUrl: sampleVideo.videoUrl,
        thumbnailUrl: sampleVideo.thumbnailUrl,
        likes: faker.number.int({ min: 0, max: 1000 }),
        comments: faker.number.int({ min: 0, max: 100 }),
        shares: faker.number.int({ min: 0, max: 500 }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await set(ref(db, `videos/${videoId}`), video);
      await set(ref(db, `users/${uid}/videos/${videoId}`), true);
    }

    console.log(`Created user ${index + 1} with profile and 5 videos`);
  } catch (error) {
    console.error(`Error creating user ${index + 1}:`, error);
  }
}

async function clearDatabase() {
  console.log('Clearing existing database...');
  try {
    // Remove all data from the main nodes
    await remove(ref(db, 'users'));
    await remove(ref(db, 'videos'));
    console.log('Database cleared successfully');
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
}

async function main() {
  console.log('Starting seed process...');

  // Clear existing data first
  await clearDatabase();

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