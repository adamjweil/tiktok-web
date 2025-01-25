import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { database } from '../lib/firebase/config';
import { ref, get, update, increment as rtdbIncrement, set } from 'firebase/database';
import { Video } from '../types/video';

// Fetch all videos
export const useVideos = (limit = 10) => {
  return useQuery<Video[]>({
    queryKey: ['videos', limit],
    queryFn: async () => {
      const videosRef = ref(database, 'videos');
      const snapshot = await get(videosRef);
      
      if (!snapshot.exists()) return [];

      const videos = [];
      for (const [id, videoData] of Object.entries(snapshot.val())) {
        const video = videoData as any;
        const userProfileRef = ref(database, `users/${video.userId}/profile`);
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

      return videos.slice(0, limit);
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
};

// Like/Unlike mutation
export const useLikeVideo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ videoId, userId, isLiked }: { videoId: string; userId: string; isLiked: boolean }) => {
      const videoRef = ref(database, `videos/${videoId}`);
      const likedByRef = ref(database, `videos/${videoId}/likedBy/${userId}`);

      await update(videoRef, {
        likes: rtdbIncrement(isLiked ? -1 : 1)
      });

      if (isLiked) {
        await set(likedByRef, null);
      } else {
        await set(likedByRef, true);
      }
    },
    onMutate: async ({ videoId, userId, isLiked }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['videos'] });

      // Snapshot the previous value
      const previousVideos = queryClient.getQueryData<Video[]>(['videos']);

      // Optimistically update to the new value
      queryClient.setQueryData<Video[]>(['videos'], (old) =>
        old?.map((video) =>
          video.id === videoId
            ? {
                ...video,
                likes: isLiked ? video.likes - 1 : video.likes + 1,
                likedBy: {
                  ...video.likedBy,
                  [userId]: !isLiked,
                },
              }
            : video
        )
      );

      return { previousVideos };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousVideos) {
        queryClient.setQueryData(['videos'], context.previousVideos);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
};

// View increment mutation
export const useIncrementViews = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoId: string) => {
      const videoRef = ref(database, `videos/${videoId}`);
      await update(videoRef, {
        views: rtdbIncrement(1)
      });
    },
    onMutate: async (videoId) => {
      await queryClient.cancelQueries({ queryKey: ['videos'] });

      const previousVideos = queryClient.getQueryData<Video[]>(['videos']);

      queryClient.setQueryData<Video[]>(['videos'], (old) =>
        old?.map((video) =>
          video.id === videoId
            ? { ...video, views: (video.views || 0) + 1 }
            : video
        )
      );

      return { previousVideos };
    },
    onError: (err, videoId, context) => {
      if (context?.previousVideos) {
        queryClient.setQueryData(['videos'], context.previousVideos);
      }
    },
  });
}; 