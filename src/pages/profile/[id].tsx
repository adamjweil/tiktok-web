import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { database, storage } from '../../lib/firebase/config';
import { ref as dbRef, get, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';

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
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex items-center space-x-6">
            <div className="relative w-32 h-32">
              <Image
                src={profile.profilePicture || '/default-avatar.png'}
                alt={profile.username}
                fill
                className="rounded-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{profile.username}</h1>
              {isEditing ? (
                <textarea
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value)}
                  className="w-full p-2 border rounded mt-2"
                  placeholder="Write your bio..."
                />
              ) : (
                <p className="text-gray-600 mt-2">{profile.bio || 'No bio yet'}</p>
              )}
              <div className="flex space-x-4 mt-4">
                <span>{profile.followers} followers</span>
                <span>{profile.following} following</span>
              </div>
            </div>
            {user && user.uid === router.query.id && (
              <div>
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    <button
                      onClick={handleProfileUpdate}
                      className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="ml-2 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                  >
                    Edit Profile
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Videos</h2>
          {videos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {videos.map((video) => (
                <div key={video.id} className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="relative h-48">
                    <Image
                      src={video.thumbnail || '/default-thumbnail.jpg'}
                      alt={video.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold">{video.title}</h3>
                    <div className="flex items-center text-sm text-gray-500 mt-2">
                      <span>{video.likes} likes</span>
                      <span className="mx-2">•</span>
                      <span>{video.comments} comments</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500">
              No videos uploaded yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 