import { useQuery } from '@tanstack/react-query';
import { database } from '../lib/firebase/config';
import { ref, get } from 'firebase/database';

interface User {
  uid: string;
  profile: {
    name: string;
    avatarUrl: string;
    followers: number;
    following: number;
  };
}

export const useUsers = () => {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (!snapshot.exists()) return [];

      const usersData = snapshot.val();
      return Object.entries(usersData).map(([uid, data]: [string, any]) => {
        const profile = data.profile || {};
        return {
          uid,
          profile: {
            name: profile.name || 'Unknown User',
            avatarUrl: profile.avatarUrl || '/default-avatar.png',
            followers: profile.followers || 0,
            following: profile.following || 0
          }
        };
      });
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}; 