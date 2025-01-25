import { useState, useCallback, Fragment, useRef } from 'react';
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
  onVideoUploaded?: () => void;
}

export default function UploadModal({ isOpen, onClose, onSuccess, onVideoUploaded }: UploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const { user } = useAuth();

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setError('');
    setSelectedFile(null);
    setThumbnailBlob(null);
  };

  const handleClose = () => {
    if (!uploading) {
      resetForm();
      onClose();
    }
  };

  const generateThumbnail = async (file: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      video.autoplay = true;
      video.muted = true;
      video.src = URL.createObjectURL(file);

      video.onloadeddata = () => {
        // Set canvas size to match video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw the first frame
        context?.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to blob
        canvas.toBlob((blob) => {
          // Clean up
          URL.revokeObjectURL(video.src);
          resolve(blob);
        }, 'image/jpeg', 0.7);
      };

      video.onerror = () => {
        console.error('Error generating thumbnail');
        URL.revokeObjectURL(video.src);
        resolve(null);
      };
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      if (!user) {
        setError('Please sign in to upload videos');
        return;
      }

      const file = acceptedFiles[0];
      if (!file) {
        setError('No file selected');
        return;
      }

      if (!file.type.startsWith('video/')) {
        setError('Please upload a video file');
        return;
      }

      if (file.size > 100 * 1024 * 1024) {
        setError('Video size should be less than 100MB');
        return;
      }

      // Generate thumbnail when file is selected
      const thumbnail = await generateThumbnail(file);
      setThumbnailBlob(thumbnail);

      // Store the selected file
      setSelectedFile(file);
      setError('');
    } catch (err) {
      console.error('Error selecting file:', err);
      setError(err instanceof Error ? err.message : 'Failed to select video. Please try again.');
    }
  }, [user]);

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    try {
      setUploading(true);
      setError('');

      // Upload video
      const videoFileName = `${Date.now()}-${selectedFile.name}`;
      const videoRef = storageRef(storage, `videos/${user.uid}/${videoFileName}`);
      
      console.log('Starting video upload...');
      await uploadBytes(videoRef, selectedFile);
      console.log('Video uploaded successfully');
      
      const videoUrl = await getDownloadURL(videoRef);
      console.log('Video URL retrieved');

      // Upload thumbnail if available
      let thumbnailUrl = '/images/default-thumbnail.svg';
      if (thumbnailBlob) {
        const thumbnailFileName = `${Date.now()}-thumbnail.jpg`;
        const thumbnailRef = storageRef(storage, `thumbnails/${user.uid}/${thumbnailFileName}`);
        await uploadBytes(thumbnailRef, thumbnailBlob);
        thumbnailUrl = await getDownloadURL(thumbnailRef);
        console.log('Thumbnail uploaded successfully');
      }

      // Save video metadata to database
      const videosRef = dbRef(database, 'videos');
      const newVideoRef = push(videosRef);
      
      console.log('Saving video metadata to database...');
      await set(newVideoRef, {
        id: newVideoRef.key,
        title: title || selectedFile.name,
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

      // Also save reference to video in user's videos collection
      await set(dbRef(database, `users/${user.uid}/videos/${newVideoRef.key}`), true);

      console.log('Upload completed successfully');
      
      // Call callbacks and close modal
      if (onVideoUploaded) {
        console.log('Calling onVideoUploaded callback');
        await onVideoUploaded();
      }
      if (onSuccess) onSuccess();
      
      resetForm();
      handleClose();
    } catch (err) {
      console.error('Error during upload process:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload video. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.webm']
    },
    maxFiles: 1,
    multiple: false,
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
                          : selectedFile 
                            ? `Selected: ${selectedFile.name}`
                            : "Drag and drop a video, or click to select"}
                      </p>
                      <p className="mt-2 text-sm text-gray-500">MP4, MOV, AVI, or WebM up to 100MB</p>
                    </div>
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
                    {selectedFile && (
                      <button
                        type="button"
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleUpload}
                        disabled={uploading}
                      >
                        {uploading ? 'Uploading...' : 'Upload Video'}
                      </button>
                    )}
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
