import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type VideoCardProps = {
  video: {
    id: string;
    userId: string;
    caption: string;
    videoUrl: string;
    likes: number;
    comments: number;
    views: number;
    username: string;
    userImage: string;
  };
};

export default function VideoCard({ video }: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="bg-white rounded-lg shadow-md overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/video/${video.id}`}>
        <div className="relative aspect-[9/16] w-full">
          {/* Video thumbnail with play button overlay */}
          <video
            src={video.videoUrl}
            className="w-full h-full object-cover"
            poster={`${video.videoUrl}?thumb=1`}
            muted
            loop
            playsInline
            autoPlay={isHovered}
          />
          {!isHovered && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
              <svg
                className="w-12 h-12 text-white opacity-80"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
        </div>
      </Link>

      <div className="p-4">
        <div className="flex items-center mb-2">
          <Link href={`/profile/${video.userId}`}>
            <div className="relative w-10 h-10 rounded-full overflow-hidden mr-3">
              <Image
                src={video.userImage || '/default-avatar.png'}
                alt={video.username}
                fill
                className="object-cover"
              />
            </div>
          </Link>
          <div>
            <Link href={`/profile/${video.userId}`}>
              <p className="font-semibold text-sm">{video.username}</p>
            </Link>
            <p className="text-sm text-gray-500 truncate">{video.caption}</p>
          </div>
        </div>

        <div className="flex justify-between text-sm text-gray-500">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {video.views.toLocaleString()}
          </div>
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {video.likes.toLocaleString()}
          </div>
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {video.comments.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
