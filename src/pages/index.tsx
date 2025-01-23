import { useEffect, useState, useRef, useCallback } from 'react';
import { database } from '../lib/firebase/config';
import { ref, query, orderByChild, limitToLast, get } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';

interface Video {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnail: string;
  userId: string;
  createdAt: string;
  likes: number;
  comments: number;
}

interface User {
  username: string;
  profilePicture: string;
}

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const pageSize = 5;

  const fetchUsers = async (userIds: string[]) => {
    const uniqueUserIds = [...new Set(userIds)];
    const newUsers: Record<string, User> = {};

    await Promise.all(
      uniqueUserIds.map(async (userId) => {
        if (!users[userId]) {
          const userRef = ref(database, `users/${userId}`);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            newUsers[userId] = snapshot.val();
          }
        }
      })
    );

    setUsers((prev) => ({ ...prev, ...newUsers }));
  };

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);

      // First, get all videos
      const videosRef = ref(database, 'videos');
      const snapshot = await get(videosRef);

      if (snapshot.exists()) {
        const allVideos: Video[] = [];
        
        // Process each user's videos
        snapshot.forEach((userSnapshot) => {
          const userId = userSnapshot.key;
          const userVideos = userSnapshot.val();
          
          // Convert user's videos to array with IDs
          Object.entries(userVideos).forEach(([videoId, videoData]: [string, any]) => {
            allVideos.push({
              id: videoId,
              ...videoData,
              userId // Ensure userId is included
            });
          });
        });

        // Sort videos by createdAt
        const sortedVideos = allVideos.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Take only the latest videos according to pageSize
        const latestVideos = sortedVideos.slice(0, pageSize);
        
        setVideos(latestVideos);
        
        // Fetch user data for the videos
        const userIds = [...new Set(latestVideos.map(video => video.userId))];
        await fetchUsers(userIds);
      } else {
        setVideos([]);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
      setError(error instanceof Error ? error.message : 'Error fetching videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleLike = useCallback(async (videoId: string) => {
    if (!user) return;
    // Implement like functionality here
    console.log('Like video:', videoId);
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {user && (
          <Link
            href="/upload"
            className="fixed bottom-8 right-8 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </Link>
        )}

        {videos.map((video) => {
          const videoUser = users[video.userId];

          return (
            <div
              key={video.id}
              className="bg-white rounded-lg shadow-md mb-8 overflow-hidden"
            >
              <div className="p-4 border-b">
                <Link href={`/profile/${video.userId}`} className="flex items-center">
                  <img
                    src={videoUser?.profilePicture || '/default-avatar.png'}
                    alt={videoUser?.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <span className="ml-2 font-medium">{videoUser?.username}</span>
                </Link>
              </div>

              <div className="relative pt-[56.25%]">
                <video
                  src={video.url}
                  className="absolute top-0 left-0 w-full h-full object-cover"
                  controls
                  playsInline
                  poster={video.thumbnail}
                />
              </div>

              <div className="p-4">
                <h2 className="text-lg font-semibold mb-2">{video.title}</h2>
                <p className="text-gray-600 mb-4">{video.description}</p>

                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handleLike(video.id)}
                    className="flex items-center space-x-1 text-gray-600 hover:text-red-500"
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                    <span>{video.likes}</span>
                  </button>

                  <div className="flex items-center space-x-1 text-gray-600">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    <span>{video.comments}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {!videos.length && (
          <div className="text-center text-gray-500 mt-8">
            No videos yet. Be the first to upload!
          </div>
        )}
      </div>
    </div>
  );
} 