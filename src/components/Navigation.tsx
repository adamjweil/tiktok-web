import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useUploadModal } from '../contexts/UploadModalContext';
import { useEffect, useState } from 'react';
import { database } from '../lib/firebase/config';
import { ref, onValue, off } from 'firebase/database';

interface UserProfile {
  name: string;
  avatarUrl?: string;
  profilePicture?: string;
}

export default function Navigation() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { openUploadModal } = useUploadModal();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const userRef = ref(database, `users/${user.uid}/profile`);
    
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.val();
        setProfile({
          name: userData.name || user.email?.split('@')[0] || 'User',
          profilePicture: userData.profilePicture,
          avatarUrl: userData.avatarUrl
        });
      } else {
        setProfile({
          name: user.email?.split('@')[0] || 'User'
        });
      }
    }, (error) => {
      console.error('Error fetching user profile:', error);
      setProfile({
        name: user.email?.split('@')[0] || 'User'
      });
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-[#f8f9fd] border-r border-gray-200 p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-xl font-bold px-4">TikTok Web</h1>
      </div>
      
      <div className="flex-1 flex flex-col space-y-1">
        <Link 
          href="/" 
          className="flex items-center px-4 py-2 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg"
        >
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Home
        </Link>

        <Link 
          href="/trending" 
          className="flex items-center px-4 py-2 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg"
        >
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Trending
        </Link>

        {user ? (
          <>
            <Link 
              href="/discover" 
              className="flex items-center px-4 py-2 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg"
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Discover
            </Link>

            <Link 
              href={`/profile/${user.uid}`} 
              className="flex items-center px-4 py-2 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg"
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </Link>

            <Link 
              href="/users" 
              className="flex items-center px-4 py-2 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg"
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Users
            </Link>
          </>
        ) : (
          <Link 
            href="/auth/login" 
            className="flex items-center px-4 py-2 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Login
          </Link>
        )}
      </div>

      {user && (
        <div className="mt-auto pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center">
              <div className="relative w-8 h-8">
                <Image
                  src={profile?.profilePicture || profile?.avatarUrl || '/default-avatar.png'}
                  alt={profile?.name || 'User'}
                  fill
                  className="rounded-full object-cover"
                />
              </div>
              <span className="ml-2 font-medium text-sm text-gray-700">
                {profile?.name || 'User'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
} 