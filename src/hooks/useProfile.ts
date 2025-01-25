import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { database, storage } from '../lib/firebase/config';
import { ref, get, set, update, increment } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Video } from '../types/video';

interface UserProfile {
  username: string;
  email: string;
  bio: string;
  profilePicture: string;
  avatarUrl?: string;
  followers: number;
  following: number;
  createdAt: string;
}

export const useProfile = (userId: string) => {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const profileRef = ref(database, `users/${userId}/profile`);
      const snapshot = await get(profileRef);
      
      if (!snapshot.exists()) {
        throw new Error('Profile not found');
      }

      return snapshot.val() as UserProfile;
    },
    enabled: !!userId,
  });
};

export const useProfileVideos = (userId: string) => {
  return useQuery({
    queryKey: ['profile-videos', userId],
    queryFn: async () => {
      const videosRef = ref(database, 'videos');
      const snapshot = await get(videosRef);
      
      if (!snapshot.exists()) return [];

      const videos: Video[] = [];
      const allVideos = snapshot.val();

      for (const [id, videoData] of Object.entries(allVideos)) {
        const video = videoData as any;
        if (video.userId === userId) {
          const userProfileRef = ref(database, `users/${userId}/profile`);
          const userProfileSnapshot = await get(userProfileRef);
          const userProfile = userProfileSnapshot.val();

          videos.push({
            id,
            ...video,
            username: userProfile?.name || 'Anonymous',
            userImage: userProfile?.avatarUrl || '/default-avatar.png',
            likedBy: video.likedBy || {},
          });
        }
      }

      return videos.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    enabled: !!userId,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      bio, 
      profilePicture 
    }: { 
      userId: string; 
      bio: string; 
      profilePicture?: File;
    }) => {
      let profilePictureUrl = undefined;

      if (profilePicture) {
        const imageRef = storageRef(storage, `profile-pictures/${userId}`);
        await uploadBytes(imageRef, profilePicture);
        profilePictureUrl = await getDownloadURL(imageRef);
      }

      const updates: Partial<UserProfile> = {
        bio,
        ...(profilePictureUrl && { profilePicture: profilePictureUrl }),
      };

      const profileRef = ref(database, `users/${userId}/profile`);
      await update(profileRef, updates);

      return updates;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile', variables.userId] });
    },
  });
};

export const useFollowUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      followerId, 
      followingId,
      isFollowing,
    }: { 
      followerId: string; 
      followingId: string;
      isFollowing: boolean;
    }) => {
      const followRef = ref(database, `users/${followerId}/following/${followingId}`);
      const followerRef = ref(database, `users/${followingId}/followers/${followerId}`);

      if (isFollowing) {
        await Promise.all([
          set(followRef, null),
          set(followerRef, null),
          update(ref(database, `users/${followingId}/profile`), {
            followers: increment(-1)
          }),
          update(ref(database, `users/${followerId}/profile`), {
            following: increment(-1)
          })
        ]);
      } else {
        await Promise.all([
          set(followRef, true),
          set(followerRef, true),
          update(ref(database, `users/${followingId}/profile`), {
            followers: increment(1)
          }),
          update(ref(database, `users/${followerId}/profile`), {
            following: increment(1)
          })
        ]);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile', variables.followingId] });
      queryClient.invalidateQueries({ queryKey: ['profile', variables.followerId] });
      
      queryClient.invalidateQueries({ 
        queryKey: ['following', variables.followerId, variables.followingId] 
      });

      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useIsFollowing = (followerId: string | undefined, followingId: string) => {
  return useQuery({
    queryKey: ['following', followerId, followingId],
    queryFn: async () => {
      if (!followerId) return false;
      const followRef = ref(database, `users/${followerId}/following/${followingId}`);
      const snapshot = await get(followRef);
      return snapshot.exists();
    },
    enabled: !!followerId && !!followingId,
  });
}; 