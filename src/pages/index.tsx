import { useEffect, useState, useRef, useCallback } from 'react';
import { database, storage } from '../lib/firebase/config';
import { ref, get, update, push, child, increment as rtdbIncrement, set } from 'firebase/database';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { useUploadModal } from '../contexts/UploadModalContext';
import SearchBar from '../components/SearchBar';

interface Video {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  userId: string;
  username: string;
  userImage: string;
  createdAt: string;
  likes: number;
  comments: number;
  shares: number;
  likedBy?: string[];
}

interface Comment {
  id: string;
  userId: string;
  username: string;
  userImage: string;
  text: string;
  createdAt: number;
}

interface SearchResultType {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  userId: string;
  username: string;
}

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const { user } = useAuth();
  const { openUploadModal } = useUploadModal();
  const pageSize = 10;

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching videos from Realtime Database...');
      const videosRef = ref(database, 'videos');
      const snapshot = await get(videosRef);

      if (snapshot.exists()) {
        const allVideos: Video[] = [];
        
        // Fetch all videos first
        for (const videoSnapshot of Object.values(snapshot.val())) {
          const videoData = videoSnapshot as any;
          
          // Fetch user profile for each video
          const userProfileRef = ref(database, `users/${videoData.userId}/profile`);
          const userProfileSnapshot = await get(userProfileRef);
          const userProfile = userProfileSnapshot.val();

          allVideos.push({
            ...videoData,
            username: userProfile?.name || 'Anonymous',
            userImage: userProfile?.avatarUrl || '/default-avatar.png',
            likedBy: videoData.likedBy ? Object.keys(videoData.likedBy) : [],
            videoUrl: videoData.videoUrl || '',
            thumbnailUrl: videoData.thumbnailUrl || '/default-thumbnail.jpg'
          });
        }

        // Sort by createdAt in descending order
        const sortedVideos = allVideos
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, pageSize);

        setVideos(sortedVideos);
      } else {
        console.log('No videos found');
        setVideos([]);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
      setError(error instanceof Error ? error.message : 'Error fetching videos');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (videoId: string) => {
    if (!user) return;

    try {
      const videoRef = ref(database, `videos/${videoId}`);
      const snapshot = await get(videoRef);
      
      if (!snapshot.exists()) return;
      
      const videoData = snapshot.val();
      const likedBy = videoData.likedBy || {};
      const isLiked = likedBy[user.uid];

      if (isLiked) {
        // Unlike
        await update(videoRef, {
          [`likedBy/${user.uid}`]: null,
          likes: (videoData.likes || 0) - 1
        });
      } else {
        // Like
        await update(videoRef, {
          [`likedBy/${user.uid}`]: true,
          likes: (videoData.likes || 0) + 1
        });
      }

      // Update local state
      setVideos(prevVideos =>
        prevVideos.map(video =>
          video.id === videoId
            ? {
                ...video,
                likes: isLiked ? (video.likes || 0) - 1 : (video.likes || 0) + 1,
                likedBy: isLiked
                  ? (video.likedBy || []).filter(uid => uid !== user.uid)
                  : [...(video.likedBy || []), user.uid]
              }
            : video
        )
      );
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const fetchComments = async (videoId: string) => {
    try {
      const commentsRef = ref(database, `videoComments/${videoId}`);
      const snapshot = await get(commentsRef);
      
      if (snapshot.exists()) {
        const commentsData = snapshot.val();
        const fetchedComments = await Promise.all(
          Object.entries(commentsData).map(async ([id, data]: [string, any]) => {
            // Fetch user profile for each comment
            const userProfileRef = ref(database, `users/${data.userId}/profile`);
            const userProfileSnapshot = await get(userProfileRef);
            const userProfile = userProfileSnapshot.val();

            return {
              id,
              ...data,
              username: userProfile?.name || 'Anonymous',
              userImage: userProfile?.avatarUrl || '/default-avatar.png',
              createdAt: new Date(data.createdAt).getTime()
            };
          })
        );

        // Sort by createdAt in descending order
        const sortedComments = fetchedComments.sort((a, b) => b.createdAt - a.createdAt);

        setComments(prev => ({
          ...prev,
          [videoId]: sortedComments
        }));
      } else {
        setComments(prev => ({
          ...prev,
          [videoId]: []
        }));
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleComment = async (videoId: string) => {
    if (!user || !newComment.trim()) return;

    try {
      const commentsRef = ref(database, `videoComments/${videoId}`);
      const videoRef = ref(database, `videos/${videoId}`);

      // Generate a new ID first and ensure it's a string
      const newCommentId = push(child(ref(database), 'temp')).key;
      if (!newCommentId) {
        throw new Error('Failed to generate comment ID');
      }

      const commentData: Comment = {
        id: newCommentId,
        text: newComment.trim(),
        userId: user.uid,
        username: user.displayName || 'Anonymous',
        userImage: user.photoURL || '/default-avatar.png',
        createdAt: Date.now()
      };

      // Add comment
      await set(ref(database, `videoComments/${videoId}/${commentData.id}`), commentData);
      await set(ref(database, `userComments/${user.uid}/${commentData.id}`), true);
      
      // Increment comment count on video
      await update(videoRef, {
        comments: rtdbIncrement(1)
      });

      // Update local state
      setComments(prev => ({
        ...prev,
        [videoId]: [commentData, ...(prev[videoId] || [])]
      }));

      // Update video comment count in local state
      setVideos(prev =>
        prev.map(video =>
          video.id === videoId
            ? { ...video, comments: (video.comments || 0) + 1 }
            : video
        )
      );

      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

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
    <div className="container mx-auto px-4 pt-2 pb-4">
      <SearchBar />
      
      {user && (
        <button
          onClick={openUploadModal}
          className="fixed bottom-8 right-8 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-colors z-50"
          aria-label="Upload video"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video) => (
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

            {/* Video thumbnail */}
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
              <h2 className="text-sm font-semibold mb-1 line-clamp-1">{video.title}</h2>
              <p className="text-xs text-gray-600 mb-2 line-clamp-2">{video.description}</p>

              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => handleLike(video.id)}
                  className={`flex items-center space-x-1 ${
                    user && video.likedBy?.includes(user.uid)
                      ? 'text-red-500'
                      : 'text-gray-600 hover:text-red-500'
                  }`}
                >
                  <svg className="h-5 w-5" fill={user && video.likedBy?.includes(user.uid) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className="text-xs">{video.likes || 0}</span>
                </button>

                <button
                  onClick={() => {
                    setShowComments(showComments === video.id ? null : video.id);
                    if (showComments !== video.id) {
                      fetchComments(video.id);
                    }
                  }}
                  className="flex items-center space-x-1 text-gray-600 hover:text-blue-500"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-xs">{video.comments || 0}</span>
                </button>
              </div>

              {/* Comments section */}
              {showComments === video.id && (
                <div className="mt-3 border-t pt-3">
                  {user && (
                    <div className="flex space-x-2 mb-3">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => handleComment(video.id)}
                        disabled={!newComment.trim()}
                        className="bg-indigo-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50 hover:bg-indigo-700"
                      >
                        Post
                      </button>
                    </div>
                  )}

                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {comments[video.id]?.map((comment) => (
                      <div key={comment.id} className="flex space-x-2 p-1 hover:bg-gray-50 rounded">
                        <Link href={`/profile/${comment.userId}`} className="flex-shrink-0">
                          <div className="relative w-6 h-6">
                            <Image
                              src={comment.userImage || '/default-avatar.png'}
                              alt={comment.username}
                              className="rounded-full object-cover"
                              fill
                              sizes="(max-width: 768px) 24px, 24px"
                            />
                          </div>
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1">
                            <Link href={`/profile/${comment.userId}`} className="text-xs font-medium text-gray-900 hover:underline">
                              {comment.username}
                            </Link>
                            <span className="text-xs text-gray-500">
                              {new Date(comment.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 break-words">{comment.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}