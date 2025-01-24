import { useEffect, useState, Fragment, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { database, storage } from '../../lib/firebase/config';
import { ref as dbRef, get, set, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { BsFillPlayCircleFill } from 'react-icons/bs';
import { Dialog, Transition } from '@headlessui/react';
import FollowListModal from '../../components/FollowListModal';

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
  title: string;
  url: string;
  thumbnail: string;
  likes: number;
  comments: number;
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
            src={video.url}
          />
        </div>
        <div className="p-4">
          <h3 className="text-xl font-semibold text-gray-900">{video.title}</h3>
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState<'followers' | 'following' | null>(null);

  useEffect(() => {
    if (!router.isReady) return;

    const userId = router.query.id as string;
    if (!userId) {
      setError('No profile ID provided');
      setLoading(false);
      return;
    }

    const checkFollowStatus = async (profileId: string) => {
      if (!user) return false;
      const followRef = dbRef(database, `follows/${user.uid}/${profileId}`);
      const snapshot = await get(followRef);
      return snapshot.exists();
    };

    const createDefaultProfile = async (userId: string) => {
      console.log('Creating default profile for user:', userId);
      const defaultProfile = {
        name: user?.email?.split('@')[0] || 'User',
        email: user?.email || '',
        city: '',
        state: '',
        followers: 0,
        following: 0,
        avatarUrl: '/default-avatar.png',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const userRef = dbRef(database, `users/${userId}/profile`);
      await set(userRef, defaultProfile);
      
      // Return the profile in the format expected by the component
      return {
        username: defaultProfile.name,
        email: defaultProfile.email,
        bio: '',
        profilePicture: defaultProfile.avatarUrl,
        followers: defaultProfile.followers,
        following: defaultProfile.following,
        createdAt: defaultProfile.createdAt,
      };
    };

    const fetchProfile = async () => {
      console.log('Fetching profile for ID:', userId);
      try {
        setLoading(true);
        setError(null);
        
        // Fetch user profile - updated to match seed.ts structure
        const userRef = dbRef(database, `users/${userId}/profile`);
        const snapshot = await get(userRef);
        
        let userProfile: UserProfile;
        if (!snapshot.exists()) {
          console.log('Profile does not exist, checking if current user');
          if (user && user.uid === userId) {
            console.log('Creating default profile for current user');
            userProfile = await createDefaultProfile(userId);
          } else {
            console.log('Profile not found and not current user');
            setError('Profile not found');
            setLoading(false);
            return;
          }
        } else {
          console.log('Profile found:', snapshot.val());
          const userData = snapshot.val();
          
          // Updated to correctly map all fields from seed.ts data structure
          userProfile = {
            username: userData.name || userData.email?.split('@')[0] || 'User',
            email: userData.email || '',
            bio: userData.city && userData.state ? `${userData.city}, ${userData.state}` : '',
            profilePicture: userData.avatarUrl || '/default-avatar.png',
            followers: userData.followers || 0,
            following: userData.following || 0,
            createdAt: userData.createdAt || new Date().toISOString(),
          };
        }
        
        setProfile(userProfile);
        
        // Check if the current user is following this profile
        if (user && user.uid !== userId) {
          const following = await checkFollowStatus(userId);
          setIsFollowing(following);
        }

        // Fetch user's videos - updated to match seed.ts structure
        const userVideosRef = dbRef(database, `users/${userId}/videos`);
        const userVideosSnapshot = await get(userVideosRef);
        
        if (userVideosSnapshot.exists()) {
          const videoIds = Object.keys(userVideosSnapshot.val());
          const videoPromises = videoIds.map(async (videoId) => {
            const videoRef = dbRef(database, `videos/${videoId}`);
            const videoSnapshot = await get(videoRef);
            if (videoSnapshot.exists()) {
              const videoData = videoSnapshot.val();
              return {
                id: videoId,
                title: videoData.title || '',
                url: videoData.videoUrl || '',
                thumbnail: videoData.thumbnailUrl || '/default-thumbnail.jpg',
                likes: videoData.likes || 0,
                comments: videoData.comments || 0,
                createdAt: videoData.createdAt || new Date().toISOString(),
              };
            }
            return null;
          });

          const videosData = await Promise.all(videoPromises);
          setVideos(videosData.filter(video => video !== null) as Video[]);
        } else {
          setVideos([]);
        }

      } catch (error) {
        console.error('Error fetching profile:', error);
        setError('Error loading profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router.isReady, router.query, user]);

  const handleProfileUpdate = async (newBio: string, file: File | null) => {
    const userId = router.query.id as string;
    if (!profile || !user || user.uid !== userId) return;

    try {
      setError(null);
      let newProfilePicture = profile.profilePicture;

      if (file) {
        const imageRef = storageRef(storage, `profile-pictures/${userId}`);
        await uploadBytes(imageRef, file);
        newProfilePicture = await getDownloadURL(imageRef);
      }

      const userRef = dbRef(database, `users/${userId}`);
      const updatedProfile = {
        ...profile,
        bio: newBio,
        profilePicture: newProfilePicture,
      };

      await set(userRef, updatedProfile);
      setProfile(updatedProfile);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile');
    }
  };

  const handleFollow = async () => {
    if (!user || !profile || user.uid === router.query.id) return;

    const profileId = router.query.id as string;
    setFollowLoading(true);

    try {
      const followRef = dbRef(database, `follows/${user.uid}/${profileId}`);
      const userProfileRef = dbRef(database, `users/${profileId}/profile`);
      const currentUserProfileRef = dbRef(database, `users/${user.uid}/profile`);

      if (isFollowing) {
        // Unfollow
        await remove(followRef);
        
        // Update follower/following counts
        const userSnapshot = await get(userProfileRef);
        if (userSnapshot.exists()) {
          const userProfile = userSnapshot.val();
          await set(userProfileRef, {
            ...userProfile,
            followers: Math.max(0, (userProfile.followers || 0) - 1)
          });
        }

        const currentUserSnapshot = await get(currentUserProfileRef);
        if (currentUserSnapshot.exists()) {
          const currentUserProfile = currentUserSnapshot.val();
          await set(currentUserProfileRef, {
            ...currentUserProfile,
            following: Math.max(0, (currentUserProfile.following || 0) - 1)
          });
        }

        setProfile(prev => prev ? {
          ...prev,
          followers: Math.max(0, (prev.followers || 0) - 1)
        } : null);
        setIsFollowing(false);
      } else {
        // Follow
        await set(followRef, true);
        
        // Update follower/following counts
        const userSnapshot = await get(userProfileRef);
        if (userSnapshot.exists()) {
          const userProfile = userSnapshot.val();
          await set(userProfileRef, {
            ...userProfile,
            followers: (userProfile.followers || 0) + 1
          });
        }

        const currentUserSnapshot = await get(currentUserProfileRef);
        if (currentUserSnapshot.exists()) {
          const currentUserProfile = currentUserSnapshot.val();
          await set(currentUserProfileRef, {
            ...currentUserProfile,
            following: (currentUserProfile.following || 0) + 1
          });
        }

        setProfile(prev => prev ? {
          ...prev,
          followers: (prev.followers || 0) + 1
        } : null);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
      setError('Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  if (!router.isReady) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

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

  if (!profile) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500">Profile not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Profile Header */}
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
                  <span className="block text-2xl font-bold text-gray-900">{videos.length}</span>
                  <span className="text-gray-500">videos</span>
                </div>
              </div>
            </div>
            <div className="flex space-x-4">
              {user && user.uid === router.query.id ? (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Edit Profile
                </button>
              ) : user && (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`px-6 py-2 rounded-lg transition-colors ${
                    isFollowing 
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  } disabled:opacity-50`}
                >
                  {followLoading ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin mr-2"></div>
                      {isFollowing ? 'Unfollowing...' : 'Following...'}
                    </div>
                  ) : (
                    isFollowing ? 'Unfollow' : 'Follow'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Videos Grid */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Videos</h2>
          {videos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div 
                  key={video.id} 
                  className="group relative bg-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="relative aspect-video bg-gray-100">
                    {video.thumbnail ? (
                      <Image
                        src={video.thumbnail}
                        alt={video.title}
                        fill
                        className="object-cover"
                        priority
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <BsFillPlayCircleFill className="w-20 h-20 text-gray-400" />
                      </div>
                    )}
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity duration-300 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                        <button 
                          onClick={() => setSelectedVideo(video)}
                          className="bg-white text-gray-900 px-6 py-2 rounded-full font-medium hover:bg-gray-100"
                        >
                          Watch Now
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-lg text-gray-900 mb-2">{video.title}</h3>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center space-x-4">
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
                      <span className="text-gray-400">{new Date(video.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
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
      </div>

      {profile && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          profile={profile}
          onSave={handleProfileUpdate}
        />
      )}

      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}

      {/* Add the modals */}
      <FollowListModal
        isOpen={showFollowModal === 'followers'}
        onClose={() => setShowFollowModal(null)}
        userId={router.query.id as string}
        type="followers"
        title="Followers"
      />
      <FollowListModal
        isOpen={showFollowModal === 'following'}
        onClose={() => setShowFollowModal(null)}
        userId={router.query.id as string}
        type="following"
        title="Following"
      />
    </div>
  );
} 