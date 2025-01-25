import { useQuery } from '@tanstack/react-query';
import { database } from '../lib/firebase/config';
import { ref, get } from 'firebase/database';
import { Video } from '../types/video';

interface TrendingVideos {
  mostLiked: Video[];
  mostCommented: Video[];
  recent: Video[];
}

export const useTrendingVideos = () => {
  return useQuery<TrendingVideos>({
    queryKey: ['trending-videos'],
    queryFn: async () => {
      const videosRef = ref(database, 'videos');
      const snapshot = await get(videosRef);
      
      if (!snapshot.exists()) {
        return { mostLiked: [], mostCommented: [], recent: [] };
      }

      const allVideos: Video[] = [];
      
      for (const [id, videoData] of Object.entries(snapshot.val())) {
        const video = videoData as any;
        const userProfileRef = ref(database, `users/${video.userId}/profile`);
        const userProfileSnapshot = await get(userProfileRef);
        const userProfile = userProfileSnapshot.val();

        allVideos.push({
          id,
          ...video,
          username: userProfile?.name || 'Anonymous',
          userImage: userProfile?.avatarUrl || '/default-avatar.png',
          likedBy: video.likedBy || {},
        });
      }

      return {
        mostLiked: [...allVideos]
          .sort((a, b) => (b.likes || 0) - (a.likes || 0))
          .slice(0, 3),
        mostCommented: [...allVideos]
          .sort((a, b) => (b.comments || 0) - (a.comments || 0))
          .slice(0, 3),
        recent: [...allVideos]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 3),
      };
    },
    staleTime: 60000, // 1 minute
    refetchOnMount: true,
  });
}; 