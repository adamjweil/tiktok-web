import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import Link from 'next/link';

interface Video {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
  userId: string;
  username: string;
  userImage: string;
  likes: number;
  comments: number;
  views: number;
}

interface VideoModalProps {
  video: Video;
  onClose: () => void;
  onVideoPlay: (videoId: string) => void;
}

export default function VideoModal({ video, onClose, onVideoPlay }: VideoModalProps) {
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
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{video.title}</h3>
                  {video.description && (
                    <p className="text-gray-600 mb-4">{video.description}</p>
                  )}
                  
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
} 