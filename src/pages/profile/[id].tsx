import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { database, storage } from '../../lib/firebase/config';
import { ref as dbRef, get, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { BsFillPlayCircleFill } from 'react-icons/bs';

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
  const [isEditing, setIsEditing] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  useEffect(() => {
    // Don't do anything until router is ready and we have the id
    if (!router.isReady) return;

    const userId = router.query.id as string;
    if (!userId) {
      setError('No profile ID provided');
      setLoading(false);
      return;
    }

    const createDefaultProfile = async (userId: string) => {
      console.log('Creating default profile for user:', userId);
      const defaultProfile: UserProfile = {
        username: user?.email?.split('@')[0] || 'User',
        email: user?.email || '',
        bio: '',
        profilePicture: '',
        followers: 0,
        following: 0,
        createdAt: new Date().toISOString(),
      };

      const userRef = dbRef(database, `users/${userId}`);
      await set(userRef, defaultProfile);
      return defaultProfile;
    };

    const fetchProfile = async () => {
      console.log('Fetching profile for ID:', userId);
      try {
        setLoading(true);
        setError(null);
        
        // Fetch user profile
        const userRef = dbRef(database, `users/${userId}`);
        const snapshot = await get(userRef);
        
        let userProfile: UserProfile;
        if (!snapshot.exists()) {
          console.log('Profile does not exist, checking if current user');
          // If profile doesn't exist and it's the current user, create a default profile
          if (user && user.uid === userId) {
            console.log('Creating default profile for current user');
            userProfile = await createDefaultProfile(userId);
            setProfile(userProfile);
            setNewBio(userProfile.bio);
          } else {
            console.log('Profile not found and not current user');
            setError('Profile not found');
            setLoading(false);
            return;
          }
        } else {
          console.log('Profile found:', snapshot.val());
          userProfile = snapshot.val();
          setProfile(userProfile);
          setNewBio(userProfile.bio || '');
        }

        // Fetch user's videos
        const videosRef = dbRef(database, `videos/${userId}`);
        const videosSnapshot = await get(videosRef);
        
        if (videosSnapshot.exists()) {
          const videosData = videosSnapshot.val();
          setVideos(Object.keys(videosData).map(key => ({
            id: key,
            ...videosData[key]
          })));
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

  const handleProfileUpdate = async () => {
    const userId = router.query.id as string;
    if (!profile || !user || user.uid !== userId) return;

    try {
      setError(null);
      let newProfilePicture = profile.profilePicture;

      if (selectedFile) {
        const imageRef = storageRef(storage, `profile-pictures/${userId}`);
        await uploadBytes(imageRef, selectedFile);
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
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile');
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
                src={profile.profilePicture || '/default-avatar.png'}
                alt={profile.username}
                fill
                className="rounded-full object-cover ring-4 ring-gray-50"
              />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{profile.username}</h1>
              {isEditing ? (
                <textarea
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value)}
                  className="w-full p-3 border rounded-lg mt-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Write your bio..."
                  rows={3}
                />
              ) : (
                <p className="text-gray-600 mt-3 text-lg">{profile.bio || 'No bio yet'}</p>
              )}
              <div className="flex space-x-6 mt-4">
                <div className="text-center">
                  <span className="block text-2xl font-bold text-gray-900">{profile.followers}</span>
                  <span className="text-gray-500">followers</span>
                </div>
                <div className="text-center">
                  <span className="block text-2xl font-bold text-gray-900">{profile.following}</span>
                  <span className="text-gray-500">following</span>
                </div>
              </div>
            </div>
            {user && user.uid === router.query.id && (
              <div>
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={handleProfileUpdate}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Edit Profile
                  </button>
                )}
              </div>
            )}
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

      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
} 