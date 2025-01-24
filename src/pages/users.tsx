import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '../lib/firebase/config';

interface User {
  uid: string;
  profile: {
    name: string;
    avatarUrl: string;
    followers: number;
    following: number;
  };
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const db = getDatabase(app);
      const usersRef = ref(db, 'users');
      
      try {
        const snapshot = await get(usersRef);
        if (snapshot.exists()) {
          const usersData = snapshot.val();
          const formattedUsers = Object.entries(usersData)
            .map(([uid, data]: [string, any]) => ({
              uid,
              profile: data.profile || {
                name: 'Unknown User',
                avatarUrl: '/default-avatar.png',
                followers: 0,
                following: 0
              }
            }))
            .filter(user => user.profile && user.profile.name); // Only include users with valid profiles
          setUsers(formattedUsers);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    user.profile?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
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

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filteredUsers.map((user) => (
              <Link
                key={user.uid}
                href={`/profile/${user.uid}`}
                className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="p-4">
                  <div className="flex items-center space-x-4">
                    <div className="relative w-16 h-16">
                      <Image
                        src={user.profile?.avatarUrl || '/default-avatar.png'}
                        alt={user.profile?.name || 'Unknown User'}
                        fill
                        className="rounded-full object-cover"
                      />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {user.profile?.name || 'Unknown User'}
                      </h2>
                      <div className="flex space-x-4 text-sm text-gray-500 mt-1">
                        <span>{user.profile?.followers || 0} followers</span>
                        <span>{user.profile?.following || 0} following</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No users found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
} 