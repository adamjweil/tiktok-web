import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import CommentModal from '../components/CommentModal';
import Navigation from '../components/Navigation';
import { database } from '../lib/firebase/config';
import { ref, onValue, off, update, increment } from 'firebase/database';

interface Video {
  id: string;
  userId: string;
  caption: string;
  videoUrl: string;
  likes: number;
  views: number;
  createdAt: string;
  userProfile?: {
    name: string;
    avatarUrl: string;
  };
  likedBy?: Record<string, boolean>;
}

export default function Discover() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLiking, setIsLiking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      router.replace('/auth/login');
      return;
    }
  }, [user, router]);

  // Fetch videos
  useEffect(() => {
    if (!user) return;

    const videosRef = ref(database, 'videos');
    const unsubscribe = onValue(videosRef, async (snapshot) => {
      if (snapshot.exists()) {
        const videosData = snapshot.val();
        const videosArray: Video[] = await Promise.all(
          Object.entries(videosData).map(async ([id, data]: [string, any]) => {
            // Fetch user profile
            const userProfileRef = ref(database, `users/${data.userId}/profile`);
            const userProfileSnapshot = await new Promise<any>((resolve) => {
              onValue(userProfileRef, resolve, { onlyOnce: true });
            });
            const userProfile = userProfileSnapshot.val();

            return {
              id,
              ...data,
              userProfile: userProfile || { name: 'Unknown User' }
            };
          })
        );
        
        // Shuffle videos
        const shuffled = [...videosArray].sort(() => Math.random() - 0.5);
        setVideos(shuffled);
        if (shuffled.length > 0 && !currentVideo) {
          setCurrentVideo(shuffled[0]);
        }
      }
    });

    return () => off(videosRef);
  }, [user]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'm') {
        setIsMuted(prev => !prev);
      } else if (e.key === 'l') {
        handleLike();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  const handleNext = () => {
    if (currentIndex < videos.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setCurrentVideo(videos[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setCurrentVideo(videos[currentIndex - 1]);
    }
  };

  const handleLike = async () => {
    if (!user || !currentVideo || isLiking) return;

    setIsLiking(true);
    try {
      const videoRef = ref(database, `videos/${currentVideo.id}`);
      const isLiked = currentVideo.likedBy?.[user.uid];

      await update(videoRef, {
        likes: increment(isLiked ? -1 : 1),
        [`likedBy/${user.uid}`]: isLiked ? null : true
      });

      setCurrentVideo(prev => prev ? {
        ...prev,
        likes: isLiked ? (prev.likes - 1) : (prev.likes + 1),
        likedBy: {
          ...prev.likedBy,
          [user.uid]: !isLiked
        }
      } : null);
    } catch (error) {
      console.error('Error updating like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleCommentClick = () => {
    if (!user) return;
    setIsCommentModalOpen(true);
  };

  const handleMuteToggle = () => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
    }
  };

  const handleVideoEnd = () => {
    handleNext();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-black">
      <Navigation />
      <main className="flex-1">
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <div className="rounded-3xl w-full max-w-4xl p-8">
            {/* Video Player Container */}
            <div className="w-full aspect-video relative">
              {currentVideo && (
                <>
                  <video
                    ref={videoRef}
                    src={currentVideo.videoUrl}
                    className="w-full h-full object-contain rounded-2xl pointer-events-none"
                    autoPlay
                    playsInline
                    muted={isMuted}
                    onEnded={handleVideoEnd}
                  />

                  {/* Video Controls Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black opacity-90 rounded-2xl">
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                      <div className="flex items-start justify-between mb-4">
                        <div className="relative z-30">
                          <Link href={`/profile/${currentVideo.userId}`} className="text-lg font-semibold hover:text-indigo-400 transition-colors">
                            @{currentVideo.userProfile?.name}
                          </Link>
                          <p className="text-sm mt-1">{currentVideo.caption}</p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-4 relative z-30">
                        <button
                          onClick={handleLike}
                          className="group flex items-center space-x-1"
                          disabled={isLiking}
                        >
                          <div className={`p-2 rounded-full ${currentVideo.likedBy?.[user.uid] 
                            ? 'bg-pink-500 text-white' 
                            : 'bg-white/10 text-white group-hover:bg-white/20'} 
                            transition-all transform ${isLiking ? 'scale-90' : 'hover:scale-110'}`}
                          >
                            <svg className="w-6 h-6" fill={currentVideo.likedBy?.[user.uid] ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </div>
                          <span>{currentVideo.likes}</span>
                        </button>

                        <button
                          onClick={handleCommentClick}
                          className="group flex items-center space-x-1"
                        >
                          <div className="p-2 rounded-full bg-white/10 text-white group-hover:bg-white/20 transition-all hover:scale-110">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                        </button>

                        <button
                          onClick={handleMuteToggle}
                          className="group flex items-center space-x-1"
                        >
                          <div className="p-2 rounded-full bg-white/10 text-white group-hover:bg-white/20 transition-all hover:scale-110">
                            {isMuted ? (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                              </svg>
                            ) : (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                              </svg>
                            )}
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4">
                    <button
                      onClick={handlePrevious}
                      disabled={currentIndex === 0}
                      className={`p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all transform hover:scale-110 ${
                        currentIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    <button
                      onClick={handleNext}
                      disabled={currentIndex === videos.length - 1}
                      className={`p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all transform hover:scale-110 ${
                        currentIndex === videos.length - 1 ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Keyboard Shortcuts Info */}
            <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-lg p-4 text-white text-sm">
              <h3 className="font-semibold mb-2">Keyboard Shortcuts</h3>
              <ul className="space-y-1">
                <li>← Previous video</li>
                <li>→ Next video</li>
                <li>M Toggle mute</li>
                <li>L Like video</li>
              </ul>
            </div>

            {/* Comment Modal */}
            {currentVideo && (
              <CommentModal
                isOpen={isCommentModalOpen}
                onClose={() => setIsCommentModalOpen(false)}
                videoId={currentVideo.id}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 
