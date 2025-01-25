import { useEffect, useState, Fragment, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { database, storage } from '../../lib/firebase/config';
import { ref as dbRef, get, set, remove, update, increment as rtdbIncrement } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import Image from 'next/image';
import { BsFillPlayCircleFill } from 'react-icons/bs';
import { Dialog, Transition } from '@headlessui/react';
import FollowListModal from '../../components/FollowListModal';
import VideoCard from '../../components/VideoCard';
import Link from 'next/link';
import UploadModal from '../../components/UploadModal';
import CommentModal from '../../components/CommentModal';
import { useProfile, useProfileVideos, useUpdateProfile, useFollowUser } from '../../hooks/useProfile';
import { useLikeVideo, useIncrementViews } from '../../hooks/useVideos';
import { Video } from '../../types/video';

interface UserProfile {
  username: string;
  email: string;
  bio: string;
  profilePicture: string;
  followers: number;
  following: number;
  createdAt: string;
}

interface Video {
  id: string;
  userId: string;
  caption: string;
  videoUrl: string;
  thumbnailUrl: string;
  likes: number;
  comments: number;
  views: number;
  username: string;
  userImage: string;
  createdAt: string;
}

interface VideoModalProps {
  video: Video | null;
  onClose: () => void;
}

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (bio: string, file: File | null) => Promise<void>;
}

const EditProfileModal = ({ isOpen, onClose, profile, onSave }: EditProfileModalProps) => {
  const [bio, setBio] = useState(profile.bio);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(profile.profilePicture);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSave(bio, selectedFile);
      onClose();
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
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
          <div className="fixed inset-0 bg-black bg-opacity-25" />
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-2xl font-medium leading-6 text-gray-900 mb-6"
                >
                  Edit Profile
                </Dialog.Title>

                <div className="space-y-6">
                  <div className="flex flex-col items-center">
                    <div className="relative w-32 h-32 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <Image
                        src={previewUrl || '/default-avatar.png'}
                        alt="Profile picture"
                        fill
                        className="rounded-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 rounded-full transition-all">
                        <svg 
                          className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                          />
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                      Bio
                    </label>
                    <textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={4}
                      className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="Tell us about yourself..."
                    />
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      onClick={onClose}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                      onClick={handleSubmit}
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
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

const VideoModal = ({ video, onClose }: VideoModalProps) => {
  if (!video) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-lg w-full max-w-4xl">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="aspect-video relative">
          <video
            className="w-full h-full rounded-t-lg"
            controls
            autoPlay
            src={video.videoUrl}
          />
        </div>
        <div className="p-4">
          <h3 className="text-xl font-semibold text-gray-900">{video.caption}</h3>
          <div className="flex items-center space-x-4 mt-2 text-gray-600">
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {video.likes}
            </span>
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {video.comments}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Profile() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = router.query.id as string;

  const { 
    data: profile, 
    isLoading: profileLoading, 
    error: profileError 
  } = useProfile(userId);
  
  const { 
    data: videos, 
    isLoading: videosLoading, 
    error: videosError,
    refetch: refreshVideos 
  } = useProfileVideos(userId);

  const updateProfileMutation = useUpdateProfile();
  const followMutation = useFollowUser();
  const likeMutation = useLikeVideo();
  const viewMutation = useIncrementViews();

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [commentModalVideo, setCommentModalVideo] = useState<Video | null>(null);
  const [showFollowModal, setShowFollowModal] = useState<'followers' | 'following' | null>(null);

  const handleProfileUpdate = async (bio: string, file: File | null) => {
    if (!user) return;
    try {
      await updateProfileMutation.mutateAsync({
        userId: user.uid,
        bio,
        profilePicture: file || undefined,
      });
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleFollow = async () => {
    if (!user || !userId) return;
    try {
      await followMutation.mutateAsync({
        followerId: user.uid,
        followingId: userId,
        isFollowing: false, // You'll need to track this state
      });
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

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

  const handleCommentModalClose = () => {
    setCommentModalVideo(null);
  };

  const handleCommentAdded = async () => {
    await refreshVideos();
  };

  if (profileLoading || videosLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (profileError || videosError) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500">Error loading profile</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow rounded-lg p-8 mb-8">
          <div className="flex items-center space-x-8">
            <div className="relative w-40 h-40">
              <Image
                src={profile?.profilePicture || '/default-avatar.png'}
                alt={profile?.username || ''}
                fill
                className="rounded-full object-cover ring-4 ring-gray-50"
              />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{profile?.username}</h1>
              <p className="text-gray-600 mt-3 text-lg">{profile?.bio || 'No bio yet'}</p>
              <div className="flex space-x-6 mt-4">
                <button 
                  onClick={() => setShowFollowModal('followers')}
                  className="text-center cursor-pointer hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
                >
                  <span className="block text-2xl font-bold text-gray-900">{profile?.followers}</span>
                  <span className="text-gray-500">followers</span>
                </button>
                <button
                  onClick={() => setShowFollowModal('following')}
                  className="text-center cursor-pointer hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
                >
                  <span className="block text-2xl font-bold text-gray-900">{profile?.following}</span>
                  <span className="text-gray-500">following</span>
                </button>
                <div className="text-center px-3 py-2">
                  <span className="block text-2xl font-bold text-gray-900">{videos?.length || 0}</span>
                  <span className="text-gray-500">videos</span>
                </div>
              </div>
            </div>
            <div className="flex space-x-4">
              {user && user.uid === userId ? (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Edit Profile
                </button>
              ) : user && (
                <button
                  onClick={handleFollow}
                  className={`px-6 py-2 rounded-lg transition-colors ${
                    followMutation.isLoading ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  } disabled:opacity-50`}
                >
                  {followMutation.isLoading ? 'Loading...' : 'Follow'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Videos</h2>
          {videos?.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div key={video.id} className="relative group bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="relative pt-[56.25%]">
                    <video
                      src={video.videoUrl}
                      className="absolute top-0 left-0 w-full h-full object-cover"
                      controls
                      playsInline
                      poster={video.thumbnailUrl || '/images/default-thumbnail.svg'}
                      onPlay={() => handleVideoPlay(video.id)}
                    />
                  </div>

                  <div className="p-3">
                    <h2 className="text-sm font-semibold mb-1 line-clamp-1">{video.caption}</h2>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-1 text-gray-600">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="text-xs">{video.views || 0}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-gray-600">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span className="text-xs">{video.likes || 0}</span>
                      </div>
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

                  {user?.uid === video.userId && (
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this video?')) {
                          // Implement delete logic here
                        }
                      }}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 z-10"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">No videos yet</h3>
              <p className="mt-1 text-gray-500">Get started by uploading your first video</p>
            </div>
          )}
        </div>

        {user && user.uid === userId && (
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
      </div>

      {isEditModalOpen && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          profile={profile!}
          onSave={handleProfileUpdate}
        />
      )}

      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}

      {showFollowModal && (
        <FollowListModal
          isOpen={!!showFollowModal}
          onClose={() => setShowFollowModal(null)}
          type={showFollowModal}
          userId={userId}
        />
      )}

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onVideoUploaded={() => refreshVideos()}
      />

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