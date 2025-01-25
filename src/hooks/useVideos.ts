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
    staleTime: 5000, // Consider data fresh for 5 seconds
  });
};

// Like/Unlike mutation
export const useLikeVideo = () => {
  const queryClient = useQueryClient();

  interface TrendingVideos {
    mostLiked: Video[];
    mostCommented: Video[];
    recent: Video[];
  }

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
      // Cancel any outgoing refetches for all video-related queries
      await queryClient.cancelQueries({ queryKey: ['videos'] });
      await queryClient.cancelQueries({ queryKey: ['profile-videos'] });
      await queryClient.cancelQueries({ queryKey: ['trending-videos'] });

      // Snapshot the previous values
      const previousVideos = queryClient.getQueryData<Video[]>(['videos']);
      const previousProfileVideos = queryClient.getQueryData<Video[]>(['profile-videos']);
      const previousTrendingVideos = queryClient.getQueryData<TrendingVideos>(['trending-videos']);

      // Update video cache helper function
      const updateVideoCache = (videos: Video[] | undefined) =>
        videos?.map((video) =>
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
        );

      // Update trending videos cache helper function
      const updateTrendingCache = (data: TrendingVideos | undefined) => {
        if (!data) return data;
        return {
          mostLiked: updateVideoCache(data.mostLiked) || [],
          mostCommented: updateVideoCache(data.mostCommented) || [],
          recent: updateVideoCache(data.recent) || [],
        };
      };

      // Update all caches optimistically
      queryClient.setQueryData<Video[]>(['videos'], (old) => updateVideoCache(old));
      queryClient.setQueryData<Video[]>(['profile-videos'], (old) => updateVideoCache(old));
      queryClient.setQueryData<TrendingVideos>(['trending-videos'], (old) => updateTrendingCache(old as TrendingVideos));

      return { previousVideos, previousProfileVideos, previousTrendingVideos };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, roll back all caches
      if (context?.previousVideos) {
        queryClient.setQueryData(['videos'], context.previousVideos);
      }
      if (context?.previousProfileVideos) {
        queryClient.setQueryData(['profile-videos'], context.previousProfileVideos);
      }
      if (context?.previousTrendingVideos) {
        queryClient.setQueryData(['trending-videos'], context.previousTrendingVideos);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['profile-videos'] });
      queryClient.invalidateQueries({ queryKey: ['trending-videos'] });
    },
  });
};

// View increment mutation
export const useIncrementViews = () => {
  const queryClient = useQueryClient();

  interface TrendingVideos {
    mostLiked: Video[];
    mostCommented: Video[];
    recent: Video[];
  }

  return useMutation({
    mutationFn: async (videoId: string) => {
      const videoRef = ref(database, `videos/${videoId}`);
      await update(videoRef, {
        views: rtdbIncrement(1)
      });
    },
    onMutate: async (videoId) => {
      // Cancel any outgoing refetches for all video-related queries
      await queryClient.cancelQueries({ queryKey: ['videos'] });
      await queryClient.cancelQueries({ queryKey: ['profile-videos'] });
      await queryClient.cancelQueries({ queryKey: ['trending-videos'] });

      // Snapshot the previous values
      const previousVideos = queryClient.getQueryData<Video[]>(['videos']);
      const previousProfileVideos = queryClient.getQueryData<Video[]>(['profile-videos']);
      const previousTrendingVideos = queryClient.getQueryData<TrendingVideos>(['trending-videos']);

      // Update video cache helper function
      const updateVideoCache = (videos: Video[] | undefined) =>
        videos?.map((video) =>
          video.id === videoId
            ? { ...video, views: (video.views || 0) + 1 }
            : video
        );

      // Update trending videos cache helper function
      const updateTrendingCache = (data: TrendingVideos | undefined) => {
        if (!data) return data;
        return {
          mostLiked: updateVideoCache(data.mostLiked) || [],
          mostCommented: updateVideoCache(data.mostCommented) || [],
          recent: updateVideoCache(data.recent) || [],
        };
      };

      // Update all caches optimistically
      queryClient.setQueryData<Video[]>(['videos'], (old) => updateVideoCache(old));
      queryClient.setQueryData<Video[]>(['profile-videos'], (old) => updateVideoCache(old));
      queryClient.setQueryData<TrendingVideos>(['trending-videos'], (old) => updateTrendingCache(old as TrendingVideos));

      return { previousVideos, previousProfileVideos, previousTrendingVideos };
    },
    onError: (err, videoId, context) => {
      // If the mutation fails, roll back all caches
      if (context?.previousVideos) {
        queryClient.setQueryData(['videos'], context.previousVideos);
      }
      if (context?.previousProfileVideos) {
        queryClient.setQueryData(['profile-videos'], context.previousProfileVideos);
      }
      if (context?.previousTrendingVideos) {
        queryClient.setQueryData(['trending-videos'], context.previousTrendingVideos);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['profile-videos'] });
      queryClient.invalidateQueries({ queryKey: ['trending-videos'] });
    },
  });
}; 