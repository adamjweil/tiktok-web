import { useState, useCallback, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useAuth } from '../contexts/AuthContext';
import { storage, database } from '../lib/firebase/config';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, push, set } from 'firebase/database';
import { useDropzone } from 'react-dropzone';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const { user } = useAuth();

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setError('');
  };

  const handleClose = () => {
    if (!uploading) {
      resetForm();
      onClose();
    }
  };

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
      const videosRef = dbRef(database, 'videos');
      const newVideoRef = push(videosRef);
      await set(newVideoRef, {
        id: newVideoRef.key,
        title: title || file.name,
        description,
        videoUrl,
        thumbnailUrl,
        createdAt: new Date().toISOString(),
        userId: user.uid,
        username: user.displayName || 'Anonymous',
        userImage: user.photoURL || '/default-avatar.png',
        likes: 0,
        comments: 0,
        shares: 0
      });

      resetForm();
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      console.error('Error uploading video:', err);
      setError('Failed to upload video');
    } finally {
      setUploading(false);
    }
  }, [user, title, description, onSuccess, onClose]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.webm']
    },
    maxFiles: 1,
  });

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-2xl font-medium leading-6 text-gray-900 mb-6"
                >
                  Upload Video
                </Dialog.Title>

                {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <span className="block sm:inline">{error}</span>
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      id="title"
                      type="text"
                      placeholder="Add a title to your video"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      id="description"
                      placeholder="Tell viewers about your video"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all h-32"
                    />
                  </div>

                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
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
                            : "Drag and drop a video, or click to select"}
                        </p>
                        <p className="mt-2 text-sm text-gray-500">MP4, MOV, AVI, or WebM up to 100MB</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      onClick={handleClose}
                      disabled={uploading}
                    >
                      Cancel
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
}
