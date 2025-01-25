import { useEffect, useState, useRef, useCallback } from 'react';
import { database, storage } from '../lib/firebase/config';
import { ref, get, update, push, child, increment as rtdbIncrement, set } from 'firebase/database';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { useUploadModal } from '../contexts/UploadModalContext';
import SearchBar from '../components/SearchBar';
import VideoModal from '../components/VideoModal';
import UploadModal from '../components/UploadModal';
import CommentModal from '../components/CommentModal';
import { useVideos, useLikeVideo, useIncrementViews } from '../hooks/useVideos';
import { Video } from '../types/video';

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
  const { data: videos, isLoading, error, refetch: refreshVideos } = useVideos();
  const likeMutation = useLikeVideo();
  const viewMutation = useIncrementViews();
  const { user } = useAuth();
  const { openUploadModal } = useUploadModal();
  const pageSize = 10;
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [commentModalVideo, setCommentModalVideo] = useState<Video | null>(null);

  const handleLike = async (videoId: string) => {
    if (!user) return;
    
    const video = videos?.find(v => v.id === videoId);
    if (!video) return;
    
    const isLiked = video.likedBy?.[user.uid] || false;
    await likeMutation.mutateAsync({ videoId, userId: user.uid, isLiked });
  };

  const handleVideoPlay = async (videoId: string) => {
    await viewMutation.mutateAsync(videoId);
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

  const handleCommentAdded = async () => {
    // Refresh videos immediately when a comment is added
    await refreshVideos();
  };

  const handleCommentModalClose = () => {
    setCommentModalVideo(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500">Error loading videos</div>
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

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {videos?.map((video) => (
          <div key={video.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* User info header */}
            <div className="p-1.5 border-b">
              <Link href={`/profile/${video.userId}`} className="flex items-center">
                <div className="relative w-6 h-6">
                  <Image
                    src={video.userImage || '/default-avatar.png'}
                    alt={video.username}
                    className="rounded-full object-cover"
                    fill
                    sizes="(max-width: 768px) 24px, 24px"
                  />
                </div>
                <span className="ml-1.5 text-xs font-medium truncate">{video.username}</span>
              </Link>
            </div>
            
            {/* Video thumbnail */}
            <div 
              className="relative pt-[66.5%] cursor-pointer group"
              onClick={() => setSelectedVideo(video)}
            >
              <video
                src={video.videoUrl}
                className="absolute top-0 left-0 w-full h-full object-cover"
                controls
                playsInline
                poster={video.thumbnailUrl || '/default-thumbnail.jpg'}
                onPlay={() => handleVideoPlay(video.id)}
              />
              <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity" />
            </div>

            {/* Video info */}
            <div className="p-2">
              <h2 
                className="text-xs font-semibold mb-1 line-clamp-1 cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => setSelectedVideo(video)}
              >
                {video.title}
              </h2>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-0.5 text-gray-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span className="text-xs">{video.views || 0}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike(video.id);
                  }}
                  className={`flex items-center space-x-0.5 ${
                    user && video.likedBy?.[user.uid]
                      ? 'text-red-500'
                      : 'text-gray-600 hover:text-red-500'
                  }`}
                >
                  <svg 
                    className="h-4 w-4" 
                    fill={user && video.likedBy?.[user.uid] ? 'currentColor' : 'none'} 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className="text-xs">{video.likes || 0}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCommentModalVideo(video);
                  }}
                  className="flex items-center space-x-0.5 text-gray-600 hover:text-indigo-600 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-xs">{video.comments || 0}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Video Modal */}
      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onVideoPlay={handleVideoPlay}
        />
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onVideoUploaded={() => refreshVideos()}
      />

      {/* Comment Modal */}
      {commentModalVideo && (
        <CommentModal
          isOpen={!!commentModalVideo}
          onClose={handleCommentModalClose}
          videoId={commentModalVideo.id}
          onCommentAdded={handleCommentAdded}
        />
      )}
    </div>
  );
}