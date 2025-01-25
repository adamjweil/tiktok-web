import { useState, useEffect, Fragment } from 'react';
import { database } from '../lib/firebase/config';
import { ref, get, query, orderByChild, limitToLast, update, increment as rtdbIncrement, set } from 'firebase/database';
import VideoCard from '../components/VideoCard';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import SearchBar from '../components/SearchBar';
import { Dialog, Transition } from '@headlessui/react';
import { useAuth } from '../contexts/AuthContext';
import UploadModal from '../components/UploadModal';
import CommentModal from '../components/CommentModal';

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
  likedBy?: Record<string, boolean>;
};

interface VideoModalProps {
  video: Video | null;
  onClose: () => void;
  onVideoPlay: (videoId: string) => void;
}

const VideoModal = ({ video, onClose, onVideoPlay }: VideoModalProps) => {
  if (!video) return null;
  const [localViews, setLocalViews] = useState(video.views);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleVideoEnd = async () => {
    await onVideoPlay(video.id);
    setIsAnimating(true);
    setLocalViews(prev => prev + 1);
    setTimeout(() => setIsAnimating(false), 1000);
  };

  return (
    <Transition appear show={true} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 z-10 p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Video container */}
                <div className="aspect-video relative bg-black">
                  <video
                    className="w-full h-full"
                    controls
                    autoPlay
                    src={video.videoUrl}
                    poster={video.thumbnailUrl}
                    onEnded={handleVideoEnd}
                  />
                </div>

                {/* Video info */}
                <div className="p-6">
                  {/* Author info */}
                  <div className="flex items-center mb-4">
                    <Link href={`/profile/${video.userId}`} className="flex items-center">
                      <div className="relative w-10 h-10">
                        <Image
                          src={video.userImage || '/default-avatar.png'}
                          alt={video.username}
                          className="rounded-full object-cover"
                          fill
                          sizes="40px"
                        />
                      </div>
                      <span className="ml-3 font-medium text-gray-900">{video.username}</span>
                    </Link>
                  </div>

                  {/* Video details */}
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{video.caption}</h3>
                  
                  {/* Stats */}
                  <div className="flex items-center space-x-6 text-gray-600">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span className={`transition-all duration-300 ${isAnimating ? 'text-indigo-600 scale-110' : ''}`}>
                        {localViews?.toLocaleString() || 0} views
                      </span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      {video.likes?.toLocaleString() || 0} likes
                    </div>
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      {video.comments?.toLocaleString() || 0} comments
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default function Trending() {
  const [mostLikedVideos, setMostLikedVideos] = useState<Video[]>([]);
  const [mostCommentedVideos, setMostCommentedVideos] = useState<Video[]>([]);
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [commentModalVideo, setCommentModalVideo] = useState<Video | null>(null);
  const { user } = useAuth();
  const [pendingRefresh, setPendingRefresh] = useState(false);

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
          likedBy: videoData.likedBy || {},
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

  const handleVideoPlay = async (videoId: string) => {
    try {
      // Update view count in the database
      const videoRef = ref(database, `videos/${videoId}`);
      await update(videoRef, {
        views: rtdbIncrement(1)
      });

      // Update local state for each section
      const updateVideos = (videos: Video[]) =>
        videos.map(video =>
          video.id === videoId
            ? { ...video, views: (video.views || 0) + 1 }
            : video
        );

      setMostLikedVideos(prev => updateVideos(prev));
      setMostCommentedVideos(prev => updateVideos(prev));
      setRecentVideos(prev => updateVideos(prev));
    } catch (error) {
      console.error('Error updating view count:', error);
    }
  };

  const handleLike = async (videoId: string) => {
    if (!user) return;

    try {
      const videoRef = ref(database, `videos/${videoId}`);
      const likedByRef = ref(database, `videos/${videoId}/likedBy/${user.uid}`);
      const videoSnapshot = await get(videoRef);

      if (!videoSnapshot.exists()) {
        console.error('Video not found');
        return;
      }

      const videoData = videoSnapshot.val();
      const isLiked = videoData.likedBy && videoData.likedBy[user.uid];

      if (isLiked) {
        // Unlike
        await update(videoRef, {
          likes: rtdbIncrement(-1)
        });
        await set(likedByRef, null);
      } else {
        // Like
        await update(videoRef, {
          likes: rtdbIncrement(1)
        });
        await set(likedByRef, true);
      }

      // Update local state for all sections
      const updateVideos = (videos: Video[]) =>
        videos.map(video => {
          if (video.id === videoId) {
            const newLikedBy = { ...(video.likedBy || {}) };
            if (isLiked) {
              delete newLikedBy[user.uid];
              return {
                ...video,
                likes: (video.likes || 0) - 1,
                likedBy: newLikedBy
              };
            } else {
              return {
                ...video,
                likes: (video.likes || 0) + 1,
                likedBy: { ...newLikedBy, [user.uid]: true }
              };
            }
          }
          return video;
        });

      setMostLikedVideos(prev => updateVideos(prev));
      setMostCommentedVideos(prev => updateVideos(prev));
      setRecentVideos(prev => updateVideos(prev));
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const handleCommentAdded = async () => {
    // Refresh videos immediately when a comment is added
    await fetchVideos();
  };

  const handleCommentModalClose = () => {
    setCommentModalVideo(null);
  };

  const refreshVideos = async () => {
    await fetchVideos();
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
              <div 
                className="relative pt-[56.25%] cursor-pointer group"
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
              <div className="p-3">
                <h2 
                  className="text-sm font-semibold mb-1 line-clamp-1 cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => setSelectedVideo(video)}
                >
                  {video.caption}
                </h2>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-1 text-gray-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className={`flex items-center space-x-1 ${
                      user && video.likedBy && video.likedBy[user.uid]
                        ? 'text-red-500'
                        : 'text-gray-600 hover:text-red-500'
                    }`}
                  >
                    <svg 
                      className="h-5 w-5" 
                      fill={user && video.likedBy && video.likedBy[user.uid] ? 'currentColor' : 'none'} 
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
                    className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600 transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="text-xs">{video.comments || 0}</span>
                  </button>
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

          {/* Add floating upload button */}
          {user && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="fixed bottom-8 right-8 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-colors z-50"
              aria-label="Upload video"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}

          {/* Video Modal */}
          {selectedVideo && (
            <VideoModal
              video={selectedVideo}
              onClose={() => setSelectedVideo(null)}
              onVideoPlay={handleVideoPlay}
            />
          )}

          {/* Comment Modal */}
          {commentModalVideo && (
            <CommentModal
              isOpen={!!commentModalVideo}
              onClose={handleCommentModalClose}
              videoId={commentModalVideo.id}
              onCommentAdded={handleCommentAdded}
            />
          )}

          {/* Add UploadModal */}
          <UploadModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onVideoUploaded={refreshVideos}
          />
        </div>
      </div>
    </>
  );
}
