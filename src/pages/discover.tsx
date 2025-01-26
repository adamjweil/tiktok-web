import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import CommentModal from '../components/CommentModal';
import Navigation from '../components/Navigation';
import { database } from '../lib/firebase/config';
import { ref, onValue, off, update, increment, push, set, serverTimestamp } from 'firebase/database';

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
  const [isPlaying, setIsPlaying] = useState(true);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentCount, setCommentCount] = useState(0);
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
        
        if (videos.length === 0) {
          // Initial load - shuffle and set first video
          const shuffled = [...videosArray].sort(() => Math.random() - 0.5);
          setVideos(shuffled);
          if (shuffled.length > 0 && !currentVideo) {
            setCurrentVideo(shuffled[0]);
            setCurrentIndex(0);
          }
        } else {
          // Update only the current video's data without changing order
          const updatedVideos = videos.map(video => {
            const updatedVideo = videosArray.find(v => v.id === video.id);
            return updatedVideo || video;
          });
          setVideos(updatedVideos);

          // Update current video data while preserving position
          if (currentVideo) {
            const updatedCurrentVideo = videosArray.find(v => v.id === currentVideo.id);
            if (updatedCurrentVideo) {
              setCurrentVideo({
                ...updatedCurrentVideo,
                userProfile: currentVideo.userProfile // Preserve user profile to prevent unnecessary updates
              });
            }
          }
        }
      }
    }, {
      // Only trigger for actual data changes
      onlyOnce: false
    });

    return () => off(videosRef);
  }, [user, currentVideo?.id]); // Only depend on user and current video ID

  // Add new effect to fetch comments when current video changes
  useEffect(() => {
    if (!currentVideo) return;

    const commentsRef = ref(database, `videoComments/${currentVideo.id}`);
    const unsubscribe = onValue(commentsRef, async (snapshot) => {
      if (snapshot.exists()) {
        const commentsData = snapshot.val();
        const commentsArray = await Promise.all(
          Object.entries(commentsData).map(async ([id, data]: [string, any]) => {
            // Fetch user profile for each comment
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
        
        // Sort comments by timestamp, most recent first
        setComments(commentsArray.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      } else {
        setComments([]);
      }
    });

    return () => off(commentsRef);
  }, [currentVideo?.id]);

  // Add effect to fetch comment count when video changes
  useEffect(() => {
    if (!currentVideo) return;

    const commentsRef = ref(database, `videoComments/${currentVideo.id}`);
    const unsubscribe = onValue(commentsRef, (snapshot) => {
      if (snapshot.exists()) {
        const count = Object.keys(snapshot.val()).length;
        setCommentCount(count);
      } else {
        setCommentCount(0);
      }
    });

    return () => off(commentsRef);
  }, [currentVideo?.id]);

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
      } else if (e.key === ' ' && e.target === document.body) {
        e.preventDefault(); // Prevent page scroll
        handlePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isPlaying]);

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

      // Update the current video state without affecting playback
      setCurrentVideo(prev => {
        if (!prev) return null;
        return {
          ...prev,
          likes: isLiked ? (prev.likes - 1) : (prev.likes + 1),
          likedBy: {
            ...prev.likedBy,
            [user.uid]: !isLiked
          }
        };
      });
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

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Update the handleCommentSubmit function
  const handleCommentSubmit = async (text: string) => {
    if (!user || !currentVideo || !text.trim()) return;

    const newCommentRef = push(ref(database, `videoComments/${currentVideo.id}`));
    await set(newCommentRef, {
      userId: user.uid,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      likes: 0
    });
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[#0f0f0f]">
      <Navigation />
      <main className="flex-1">
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="w-full max-w-[1280px]">
            {/* Video Player Container */}
            <div className="w-full aspect-video relative group">
              {currentVideo && (
                <>
                  <video
                    ref={videoRef}
                    src={currentVideo.videoUrl}
                    className="w-full h-full object-contain bg-black"
                    autoPlay
                    playsInline
                    muted={isMuted}
                    onEnded={handleVideoEnd}
                  />

                  {/* Background Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />

                  {/* Play/Pause Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center z-30">
                    <button
                      onClick={handlePlayPause}
                      className="w-16 h-16 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60 transition-all"
                    >
                      {isPlaying ? (
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7 0a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4 z-30">
                    <button
                      onClick={handlePrevious}
                      disabled={currentIndex === 0}
                      className={`p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all ${
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
                      className={`p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all ${
                        currentIndex === videos.length - 1 ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* Bottom Controls and Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 z-30">
                    {/* Video Info Section */}
                    <div className="flex items-start space-x-4 mb-3">
                      <Link href={`/profile/${currentVideo.userId}`} className="flex-shrink-0">
                        {currentVideo.userProfile?.avatarUrl ? (
                          <Image
                            src={currentVideo.userProfile.avatarUrl}
                            alt={currentVideo.userProfile.name}
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                            <span className="text-lg">{currentVideo.userProfile?.name[0]}</span>
                          </div>
                        )}
                      </Link>
                      <div className="flex-1">
                        <Link href={`/profile/${currentVideo.userId}`} className="text-base font-medium text-white hover:text-gray-300 transition-colors">
                          {currentVideo.userProfile?.name}
                        </Link>
                        <p className="text-sm text-gray-300 mt-1">{currentVideo.caption}</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleLike}
                        className="group flex items-center space-x-1 px-3 py-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all"
                        disabled={isLiking}
                      >
                        <svg className={`w-5 h-5 ${currentVideo.likedBy?.[user.uid] ? 'text-[#ff0000]' : 'text-white'}`} 
                             fill={currentVideo.likedBy?.[user.uid] ? 'currentColor' : 'none'} 
                             stroke="currentColor" 
                             viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span className="text-sm">{currentVideo.likes}</span>
                      </button>

                      <button
                        onClick={handleCommentClick}
                        className="group flex items-center space-x-1 px-3 py-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all"
                      >
                        <div className="flex items-center space-x-1">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span className="text-sm">{commentCount}</span>
                        </div>
                      </button>

                      <button
                        onClick={handleMuteToggle}
                        className="group flex items-center space-x-1 px-3 py-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all"
                      >
                        {isMuted ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Info Row */}
            <div className="mt-4 flex items-center justify-between">
              {/* Keyboard Shortcuts (Left) */}
              <div className="flex items-center space-x-2">
                <span className="text-white/70 text-sm">Keyboard Shortcuts</span>
                <button
                  onClick={() => setIsShortcutsModalOpen(true)}
                  className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all flex items-center"
                  title="Keyboard Shortcuts"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>

              {/* Video Counter (Right) */}
              <div className="text-white/70 text-sm">
                Displaying {currentIndex + 1} of {videos.length} videos
              </div>
            </div>

            {/* Keyboard Shortcuts Modal */}
            {isShortcutsModalOpen && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                <div className="bg-[#272727] rounded-lg max-w-md w-full mx-4 p-6 relative">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-white">Keyboard Shortcuts</h3>
                    <button
                      onClick={() => setIsShortcutsModalOpen(false)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-3">
                        <kbd className="px-2.5 py-1.5 bg-[#3d3d3d] rounded text-sm font-medium text-white">←</kbd>
                        <span className="text-white/70">Previous video</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <kbd className="px-2.5 py-1.5 bg-[#3d3d3d] rounded text-sm font-medium text-white">→</kbd>
                        <span className="text-white/70">Next video</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <kbd className="px-2.5 py-1.5 bg-[#3d3d3d] rounded text-sm font-medium text-white">M</kbd>
                        <span className="text-white/70">Toggle mute</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <kbd className="px-2.5 py-1.5 bg-[#3d3d3d] rounded text-sm font-medium text-white">L</kbd>
                        <span className="text-white/70">Like video</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <kbd className="px-2.5 py-1.5 bg-[#3d3d3d] rounded text-sm font-medium text-white">Space</kbd>
                        <span className="text-white/70">Play/Pause</span>
                      </div>
                    </div>
                    <p className="text-sm text-white/50 mt-4">
                      Click anywhere outside this modal to close
                    </p>
                  </div>
                </div>
                <div 
                  className="absolute inset-0 -z-10" 
                  onClick={() => setIsShortcutsModalOpen(false)}
                />
              </div>
            )}

            {/* Comment Modal */}
            {currentVideo && (
              <CommentModal
                isOpen={isCommentModalOpen}
                onClose={() => setIsCommentModalOpen(false)}
                videoId={currentVideo.id}
              />
            )}

            {/* Comments Section */}
            <div className="mt-6 border-t border-gray-800">
              <div className="py-6">
                <h3 className="text-white text-lg font-medium mb-6">Comments</h3>
                
                {/* Comment Input */}
                <div className="flex space-x-4 mb-8">
                  <div className="flex-shrink-0">
                    {user?.photoURL ? (
                      <Image
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                        <span className="text-lg text-white">{user?.displayName?.[0] || 'U'}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      className="w-full bg-transparent border-b border-gray-700 text-white px-2 py-1 focus:outline-none focus:border-gray-500 placeholder-gray-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleCommentSubmit(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-6">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex space-x-4">
                      <div className="flex-shrink-0">
                        {comment.userProfile?.avatarUrl ? (
                          <Image
                            src={comment.userProfile.avatarUrl}
                            alt={comment.userProfile.name}
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                            <span className="text-lg text-white">{comment.userProfile?.name[0]}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-white font-medium">{comment.userProfile?.name}</span>
                          <span className="text-gray-400 text-sm">
                            {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : 'Just now'}
                          </span>
                        </div>
                        <p className="text-white">{comment.text}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <button className="text-gray-400 hover:text-white transition-colors flex items-center space-x-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                            </svg>
                            <span className="text-sm">{comment.likes || 0}</span>
                          </button>
                          <button className="text-gray-400 hover:text-white transition-colors">
                            <span className="text-sm">Reply</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 
