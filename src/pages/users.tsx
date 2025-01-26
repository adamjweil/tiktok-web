import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { Tab } from '@headlessui/react';
import { useQuery } from '@tanstack/react-query';
import { database } from '../lib/firebase/config';
import { ref, get, query, orderByChild, limitToLast } from 'firebase/database';

interface User {
  uid: string;
  profile: {
    name: string;
    avatarUrl: string;
    followers: number;
    following: number;
    lastActive?: string;
    createdAt?: string;
    bio?: string;
    videosCount?: number;
  };
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

// Add this helper function to filter users
const filterUsersBySearch = (users: User[] | undefined, searchQuery: string) => {
  if (!users || !searchQuery) return users;
  const query = searchQuery.toLowerCase();
  return users.filter(user => 
    user.profile.name.toLowerCase().includes(query) ||
    (user.profile.bio && user.profile.bio.toLowerCase().includes(query))
  );
};

export default function Users() {
  const { user } = useAuth();
  const { data: users, isLoading: isUsersLoading } = useUsers();
  const { data: currentUserProfile } = useProfile(user?.uid || '');
  const [searchQuery, setSearchQuery] = useState('');

  // Query for new users (ordered by creation date)
  const { data: newUsers, isLoading: isNewUsersLoading } = useQuery<User[]>({
    queryKey: ['new-users'],
    queryFn: async () => {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (!snapshot.exists()) return [];

      return Object.entries(snapshot.val())
        .map(([uid, data]: [string, any]) => ({
          uid,
          profile: {
            name: data.profile?.name || 'Unknown User',
            avatarUrl: data.profile?.avatarUrl || '/default-avatar.png',
            followers: data.profile?.followers || 0,
            following: data.profile?.following || 0,
            createdAt: data.registeredAt || data.profile?.createdAt || data.createdAt,
            bio: data.profile?.bio || null,
            videosCount: data.videosCount || 0
          }
        }))
        .sort((a, b) => {
          const dateA = new Date(a.profile.createdAt || 0).getTime();
          const dateB = new Date(b.profile.createdAt || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, 5);
    }
  });

  // Query for most active users (could be based on post count, login frequency, etc.)
  const { data: activeUsers, isLoading: isActiveUsersLoading } = useQuery<User[]>({
    queryKey: ['active-users'],
    queryFn: async () => {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (!snapshot.exists()) return [];

      return Object.entries(snapshot.val())
        .map(([uid, data]: [string, any]) => ({
          uid,
          profile: {
            name: data.profile?.name || 'Unknown User',
            avatarUrl: data.profile?.avatarUrl || '/default-avatar.png',
            followers: data.profile?.followers || 0,
            following: data.profile?.following || 0,
            lastActive: data.profile?.lastActive
          }
        }))
        .sort((a, b) => (b.profile.followers + b.profile.following) - (a.profile.followers + a.profile.following))
        .slice(0, 5);
    }
  });

  // Get current user's followers
  const { data: followers, isLoading: isFollowersLoading } = useQuery<User[]>({
    queryKey: ['followers', user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const followersRef = ref(database, `userFollowers/${user.uid}`);
      const snapshot = await get(followersRef);
      
      if (!snapshot.exists()) return [];

      const followerIds = Object.keys(snapshot.val());
      const followerProfiles = await Promise.all(
        followerIds.map(async (followerId) => {
          const userRef = ref(database, `users/${followerId}`);
          const userSnapshot = await get(userRef);
          const userData = userSnapshot.val();
          return {
            uid: followerId,
            profile: {
              name: userData.profile?.name || 'Unknown User',
              avatarUrl: userData.profile?.avatarUrl || '/default-avatar.png',
              followers: userData.profile?.followers || 0,
              following: userData.profile?.following || 0
            }
          };
        })
      );
      return followerProfiles;
    }
  });

  // Get users the current user is following
  const { data: following, isLoading: isFollowingLoading } = useQuery<User[]>({
    queryKey: ['following', user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const followingRef = ref(database, `userFollowing/${user.uid}`);
      const snapshot = await get(followingRef);
      
      if (!snapshot.exists()) return [];

      const followingIds = Object.keys(snapshot.val());
      const followingProfiles = await Promise.all(
        followingIds.map(async (followingId) => {
          const userRef = ref(database, `users/${followingId}`);
          const userSnapshot = await get(userRef);
          const userData = userSnapshot.val();
          return {
            uid: followingId,
            profile: {
              name: userData.profile?.name || 'Unknown User',
              avatarUrl: userData.profile?.avatarUrl || '/default-avatar.png',
              followers: userData.profile?.followers || 0,
              following: userData.profile?.following || 0
            }
          };
        })
      );
      return followingProfiles;
    }
  });

  // Update the filtered lists with the search query
  const filteredAllUsers = filterUsersBySearch(users, searchQuery);
  const filteredFollowers = filterUsersBySearch(followers, searchQuery);
  const filteredFollowing = filterUsersBySearch(following, searchQuery);
  const filteredNewUsers = filterUsersBySearch(newUsers, searchQuery);
  const filteredActiveUsers = filterUsersBySearch(activeUsers, searchQuery);

  const renderUserGrid = (userList: User[] | undefined, isLoading: boolean, emptyMessage: string) => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      );
    }

    if (!userList?.length) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {userList.map((user) => (
          <Link
            key={user.uid}
            href={`/profile/${user.uid}`}
            className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-4">
              <div className="flex items-center space-x-4">
                <div className="relative w-16 h-16">
                  <Image
                    src={user.profile.avatarUrl}
                    alt={user.profile.name}
                    fill
                    className="rounded-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {user.profile.name}
                  </h2>
                  <div className="flex space-x-4 text-sm text-gray-500 mt-1">
                    <span>{user.profile.followers} followers</span>
                    <span>{user.profile.following} following</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  };

  const renderNewUserGrid = (userList: User[] | undefined, isLoading: boolean, emptyMessage: string) => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      );
    }

    if (!userList?.length) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6">
        {userList.map((user, index) => (
          <Link
            key={user.uid}
            href={`/profile/${user.uid}`}
            className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-6">
              <div className="flex items-center">
                <div className="relative w-20 h-20">
                  <Image
                    src={user.profile.avatarUrl}
                    alt={user.profile.name}
                    fill
                    className="rounded-full object-cover"
                  />
                  <div className="absolute -top-2 -left-2 bg-indigo-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium">
                    #{index + 1}
                  </div>
                </div>
                <div className="ml-6 flex-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {user.profile.name}
                    </h2>
                    <span className="text-sm text-gray-500">
                      Joined {new Date(user.profile.createdAt || 0).toLocaleDateString()}
                    </span>
                  </div>
                  {user.profile.bio && (
                    <p className="mt-1 text-gray-600 line-clamp-2">{user.profile.bio}</p>
                  )}
                  <div className="mt-3 flex items-center space-x-6 text-sm text-gray-500">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>{user.profile.followers} followers</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>{user.profile.videosCount} videos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Users</h1>
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <svg
              className="absolute right-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-xl bg-white p-1 mb-6 shadow-sm">
            <Tab
              className={({ selected }) =>
                classNames(
                  'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                  'ring-white ring-opacity-60 ring-offset-2 ring-offset-indigo-400 focus:outline-none focus:ring-2',
                  selected
                    ? 'bg-indigo-100 text-indigo-700 shadow'
                    : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                )
              }
            >
              All Users
            </Tab>
            {user && (
              <>
                <Tab
                  className={({ selected }) =>
                    classNames(
                      'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                      'ring-white ring-opacity-60 ring-offset-2 ring-offset-indigo-400 focus:outline-none focus:ring-2',
                      selected
                        ? 'bg-indigo-100 text-indigo-700 shadow'
                        : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                    )
                  }
                >
                  Your Followers
                </Tab>
                <Tab
                  className={({ selected }) =>
                    classNames(
                      'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                      'ring-white ring-opacity-60 ring-offset-2 ring-offset-indigo-400 focus:outline-none focus:ring-2',
                      selected
                        ? 'bg-indigo-100 text-indigo-700 shadow'
                        : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                    )
                  }
                >
                  Following
                </Tab>
              </>
            )}
            <Tab
              className={({ selected }) =>
                classNames(
                  'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                  'ring-white ring-opacity-60 ring-offset-2 ring-offset-indigo-400 focus:outline-none focus:ring-2',
                  selected
                    ? 'bg-indigo-100 text-indigo-700 shadow'
                    : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                )
              }
            >
              New Users
            </Tab>
            <Tab
              className={({ selected }) =>
                classNames(
                  'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                  'ring-white ring-opacity-60 ring-offset-2 ring-offset-indigo-400 focus:outline-none focus:ring-2',
                  selected
                    ? 'bg-indigo-100 text-indigo-700 shadow'
                    : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                )
              }
            >
              Most Active
            </Tab>
          </Tab.List>

          <Tab.Panels className="mt-2">
            <Tab.Panel>
              {renderUserGrid(filteredAllUsers, isUsersLoading, 'No users found matching your search.')}
            </Tab.Panel>
            
            {user && (
              <>
                <Tab.Panel>
                  {renderUserGrid(filteredFollowers, isFollowersLoading, 'No followers found matching your search.')}
                </Tab.Panel>
                <Tab.Panel>
                  {renderUserGrid(filteredFollowing, isFollowingLoading, 'No following users found matching your search.')}
                </Tab.Panel>
              </>
            )}
            
            <Tab.Panel>
              {renderNewUserGrid(filteredNewUsers, isNewUsersLoading, 'No new users found matching your search.')}
            </Tab.Panel>
            
            <Tab.Panel>
              {renderUserGrid(filteredActiveUsers, isActiveUsersLoading, 'No active users found matching your search.')}
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </div>
  );
} 