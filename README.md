# TikTok Web Clone

A Next.js-based web application that replicates core TikTok functionality.

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- A Firebase project with Authentication and Realtime Database enabled

## Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd tiktok-web
```

2. Install dependencies:
```bash
npm install
```

3. Set up Firebase:
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication with Email/Password sign-in method
   - Enable Realtime Database
   - Generate a new Service Account Key:
     - Go to Project Settings > Service Accounts
     - Click "Generate New Private Key"
     - Save the file as `serviceAccountKey.json` in the project root

4. Create a `.env` file in the project root with your Firebase configuration:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_DATABASE_URL=your_database_url
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Seeding the Database

The application comes with a seeding script that creates:
- A main user account (email: adamjweil@gmail.com, password: password)
- 10 additional random user accounts
- 10 videos for the main account
- 5 videos for each random user
- Random likes and comments between users
- Following relationships between users

To seed the database:
```bash
npm run seed
```

Note: If you encounter rate limiting errors during seeding, the script will automatically retry with delays between attempts.

## Features

- User authentication (sign up, sign in)
- User profiles with avatars
- Video upload and playback
- Like and comment functionality
- User following system
- Real-time updates using Firebase Realtime Database

## Project Structure

- `/pages` - Next.js pages and API routes
- `/components` - Reusable React components
- `/scripts` - Utility scripts including database seeding
- `/public` - Static assets
- `/styles` - CSS and styling files

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
