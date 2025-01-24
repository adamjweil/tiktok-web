import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { database } from '../lib/firebase/config';
import { ref, get } from 'firebase/database';

interface User {
  id: string;
  name: string;
  avatarUrl: string;
  bio: string | null;
}

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: 'followers' | 'following';
  title: string;
}

export default function FollowListModal({ isOpen, onClose, userId, type, title }: FollowListModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!isOpen) return;
      
      setLoading(true);
      try {
        const followsRef = ref(database, type === 'followers' 
          ? `userFollowers/${userId}` // People who follow this user
          : `follows/${userId}` // People this user follows
        );
        const snapshot = await get(followsRef);
        
        if (snapshot.exists()) {
          const userIds = Object.keys(snapshot.val());
          const userProfiles = await Promise.all(
            userIds.map(async (id) => {
              const userRef = ref(database, `users/${id}/profile`);
              const userSnapshot = await get(userRef);
              if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                return {
                  id,
                  name: userData.name || 'Anonymous',
                  avatarUrl: userData.avatarUrl || '/default-avatar.png',
                  bio: userData.bio || null
                } as User;
              }
              return null;
            })
          );
          
          setUsers(userProfiles.filter((profile): profile is User => profile !== null));
        } else {
          setUsers([]);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isOpen, userId, type]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No {type} yet
            </div>
          ) : (
            <div className="space-y-4">
              {users.map(user => (
                <Link
                  key={user.id}
                  href={`/profile/${user.id}`}
                  className="flex items-center p-2 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <Image
                      src={user.avatarUrl}
                      alt={user.name}
                      fill
                      className="rounded-full object-cover"
                      sizes="48px"
                    />
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{user.name}</p>
                    {user.bio && (
                      <p className="text-sm text-gray-500 truncate">{user.bio}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 