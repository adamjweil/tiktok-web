import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import VideoCard from '../components/VideoCard';
import Head from 'next/head';

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
};

type SortOption = 'views' | 'likes' | 'comments';

export default function Trending() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('views');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrendingVideos();
  }, [sortBy]);

  const fetchTrendingVideos = async () => {
    try {
      setLoading(true);
      const videosRef = collection(db, 'videos');
      const q = query(
        videosRef,
        orderBy(sortBy, 'desc'),
        limit(20)
      );

      const querySnapshot = await getDocs(q);
      const videoData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Video[];

      setVideos(videoData);
    } catch (error) {
      console.error('Error fetching trending videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortOptions: { label: string; value: SortOption }[] = [
    { label: 'Most Viewed', value: 'views' },
    { label: 'Most Liked', value: 'likes' },
    { label: 'Most Commented', value: 'comments' },
  ];

  return (
    <>
      <Head>
        <title>Trending Videos | TikTok Web</title>
      </Head>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Trending Videos</h1>
            <div className="mt-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="mt-1 block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          )}

          {!loading && videos.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No trending videos found</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
