import { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { storage, database } from '../lib/firebase/config';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, push, set } from 'firebase/database';
import { useDropzone } from 'react-dropzone';

export default function Upload() {
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const { user } = useAuth();
  const router = useRouter();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) {
      setError('Please sign in to upload videos');
      return;
    }

    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Please upload a video file');
      return;
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      setError('Video size should be less than 100MB');
      return;
    }

    try {
      setUploading(true);
      setError('');

      // Upload video
      const videoFileName = `${Date.now()}-${file.name}`;
      const videoRef = storageRef(storage, `videos/${user.uid}/${videoFileName}`);
      await uploadBytes(videoRef, file);
      const videoUrl = await getDownloadURL(videoRef);

      // Generate thumbnail (in production, you'd want to do this server-side)
      const thumbnailUrl = '/default-thumbnail.jpg'; // Placeholder

      // Save video metadata to database
      const videosRef = dbRef(database, `videos/${user.uid}`);
      const newVideoRef = push(videosRef);
      await set(newVideoRef, {
        title: title || file.name,
        description,
        url: videoUrl,
        thumbnail: thumbnailUrl,
        createdAt: new Date().toISOString(),
        userId: user.uid,
        likes: 0,
        comments: 0,
      });

      router.push(`/profile/${user.uid}`);
    } catch (err) {
      console.error('Error uploading video:', err);
      setError('Failed to upload video');
    } finally {
      setUploading(false);
    }
  }, [user, title, description, router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.webm']
    },
    maxFiles: 1,
  });

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Please sign in to upload videos
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Upload Video</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="mb-6">
          <input
            type="text"
            placeholder="Video title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="mb-6">
          <textarea
            placeholder="Video description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 h-32"
          />
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-500'
          }`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Uploading video...</p>
            </div>
          ) : (
            <div>
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 14v20c0 4.418 3.582 8 8 8h16c4.418 0 8-3.582 8-8V14m-4 0l-8-8-8 8m8-8v28"
                />
              </svg>
              <p className="mt-4 text-gray-600">
                {isDragActive
                  ? "Drop the video here"
                  : "Drag 'n' drop a video, or click to select"}
              </p>
              <p className="mt-2 text-sm text-gray-500">MP4, MOV, AVI, or WebM up to 100MB</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 