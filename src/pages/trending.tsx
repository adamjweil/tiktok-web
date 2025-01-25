import { useState, useEffect } from 'react';
import { database } from '../lib/firebase/config';
import { ref, get, query, orderByChild, limitToLast } from 'firebase/database';
import VideoCard from '../components/VideoCard';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import SearchBar from '../components/SearchBar';

type Video = {
  id: string;
  userId: string;
  caption: string;
  videoUrl: string;
  likes: number;
  comments: number;
  views: number;
  username: string;
  userImage: string;
  createdAt: string;
  thumbnailUrl?: string;
};

export default function Trending() {
  const [mostLikedVideos, setMostLikedVideos] = useState<Video[]>([]);
  const [mostCommentedVideos, setMostCommentedVideos] = useState<Video[]>([]);
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const videosRef = ref(database, 'videos');

      // Fetch all videos first
      const snapshot = await get(videosRef);
      if (!snapshot.exists()) {
        console.log('No videos found');
        return;
      }

      const allVideos: Video[] = [];
      
      // Process each video
      for (const childSnapshot of Object.values(snapshot.val())) {
        const videoData = childSnapshot as any;
        
        // Fetch user profile for each video
        const userProfileRef = ref(database, `users/${videoData.userId}/profile`);
        const userProfileSnapshot = await get(userProfileRef);
        const userProfile = userProfileSnapshot.val();

        allVideos.push({
          id: videoData.id || '',
          userId: videoData.userId || '',
          caption: videoData.title || '',
          videoUrl: videoData.videoUrl || '',
          likes: videoData.likes || 0,
          comments: videoData.comments || 0,
          views: videoData.views || 0,
          username: userProfile?.name || videoData.username || 'Anonymous',
          userImage: userProfile?.avatarUrl || videoData.userImage || '/default-avatar.png',
          createdAt: videoData.createdAt || '',
          thumbnailUrl: videoData.thumbnailUrl || undefined,
        });
      }

      // Sort for most liked videos
      const sortedByLikes = [...allVideos].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 3);
      setMostLikedVideos(sortedByLikes);

      // Sort for most commented videos
      const sortedByComments = [...allVideos].sort((a, b) => (b.comments || 0) - (a.comments || 0)).slice(0, 3);
      setMostCommentedVideos(sortedByComments);

      // Sort for most recent videos
      const sortedByDate = [...allVideos].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ).slice(0, 3);
      setRecentVideos(sortedByDate);

    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const Section = ({ title, description, videos }: { title: string; description: string; videos: Video[] }) => (
    <section className="mb-16">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600">{description}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos && videos.length > 0 ? (
          videos.map((video) => (
            <div key={video.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* User info header */}
              <div className="p-2 border-b">
                <Link href={`/profile/${video.userId}`} className="flex items-center">
                  <div className="relative w-8 h-8">
                    <Image
                      src={video.userImage || '/default-avatar.png'}
                      alt={video.username}
                      className="rounded-full object-cover"
                      fill
                      sizes="(max-width: 768px) 32px, 32px"
                    />
                  </div>
                  <span className="ml-2 text-sm font-medium truncate">{video.username}</span>
                </Link>
              </div>
              
              {/* Video card */}
              <div className="relative pt-[56.25%]">
                <video
                  src={video.videoUrl}
                  className="absolute top-0 left-0 w-full h-full object-cover"
                  controls
                  playsInline
                  poster={video.thumbnailUrl || '/default-thumbnail.jpg'}
                />
              </div>

              {/* Video info */}
              <div className="p-3">
                <h2 className="text-sm font-semibold mb-1 line-clamp-1">{video.caption}</h2>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-1 text-gray-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span className="text-xs">{video.likes || 0}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-gray-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="text-xs">{video.comments || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500">No videos found in this section</p>
        )}
      </div>
    </section>
  );

  return (
    <>
      <Head>
        <title>Trending Videos | TikTok Web</title>
      </Head>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <SearchBar />

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <>
              <Section
                title="Most Liked Videos"
                description="The cream of the crop - these videos have captured hearts across the platform! 💖"
                videos={mostLikedVideos}
              />

              <Section
                title="Most Commented Videos"
                description="Join the conversation - these videos have everyone talking! 💬"
                videos={mostCommentedVideos}
              />

              <Section
                title="Fresh Off the Press"
                description="Hot and fresh content - catch these trending videos before everyone else! 🔥"
                videos={recentVideos}
              />
            </>
          )}

          {!loading && !mostLikedVideos.length && !mostCommentedVideos.length && !recentVideos.length && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No trending videos found</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
