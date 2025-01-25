import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../lib/firebase/config';
import { ref, push, set, get, query, orderByChild, remove } from 'firebase/database';

interface Comment {
  id: string;
  userId: string;
  username: string;
  userImage: string;
  text: string;
  createdAt: string;
}

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  onCommentAdded?: () => void;
}

export default function CommentModal({ isOpen, onClose, videoId, onCommentAdded }: CommentModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ avatarUrl: string; name: string } | null>(null);
  const { user } = useAuth();

  const quickComments = [
    "Great video! 🎉",
    "Awesome! 🔥",
    "Love this! ❤️",
    "Keep it up! 👏"
  ];

  useEffect(() => {
    if (isOpen && videoId && user) {
      fetchComments();
      fetchCurrentUserProfile();
    }
  }, [isOpen, videoId, user]);

  const fetchCurrentUserProfile = async () => {
    if (!user) return;
    try {
      const userProfileRef = ref(database, `users/${user.uid}/profile`);
      const snapshot = await get(userProfileRef);
      if (snapshot.exists()) {
        setCurrentUserProfile(snapshot.val());
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchComments = async () => {
    try {
      setLoading(true);
      const commentsRef = ref(database, `videoComments/${videoId}`);
      const snapshot = await get(commentsRef);

      const fetchedComments: Comment[] = [];
      if (snapshot.exists()) {
        const commentsData = snapshot.val();
        for (const [id, comment] of Object.entries(commentsData)) {
          const commentData = comment as any;
          // Fetch user profile for the comment
          const userProfileRef = ref(database, `users/${commentData.userId}/profile`);
          const userProfileSnapshot = await get(userProfileRef);
          const userProfile = userProfileSnapshot.val();

          fetchedComments.push({
            id,
            userId: commentData.userId,
            username: userProfile?.name || 'Anonymous',
            userImage: userProfile?.avatarUrl || '/default-avatar.png',
            text: commentData.text,
            createdAt: commentData.createdAt,
          });
        }
      }
      // Sort comments by createdAt in memory
      fetchedComments.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setComments(fetchedComments); // No need for reverse() since we're already sorting newest first
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || submitting) return;

    try {
      setSubmitting(true);
      const commentsRef = ref(database, `videoComments/${videoId}`);
      const newCommentRef = push(commentsRef);
      
      await set(newCommentRef, {
        userId: user.uid,
        text: newComment.trim(),
        createdAt: new Date().toISOString(),
      });

      // Update video's comment count
      const videoRef = ref(database, `videos/${videoId}`);
      const videoSnapshot = await get(videoRef);
      if (videoSnapshot.exists()) {
        const videoData = videoSnapshot.val();
        await set(videoRef, {
          ...videoData,
          comments: (videoData.comments || 0) + 1,
        });
      }

      setNewComment('');
      await fetchComments();
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickComment = async (comment: string) => {
    if (!user || submitting) return;

    try {
      setSubmitting(true);
      const commentsRef = ref(database, `videoComments/${videoId}`);
      const newCommentRef = push(commentsRef);
      
      await set(newCommentRef, {
        userId: user.uid,
        text: comment,
        createdAt: new Date().toISOString(),
      });

      // Update video's comment count
      const videoRef = ref(database, `videos/${videoId}`);
      const videoSnapshot = await get(videoRef);
      if (videoSnapshot.exists()) {
        const videoData = videoSnapshot.val();
        await set(videoRef, {
          ...videoData,
          comments: (videoData.comments || 0) + 1,
        });
      }

      await fetchComments();
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (error) {
      console.error('Error posting quick comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    
    try {
      setSubmitting(true);
      // Delete the comment
      const commentRef = ref(database, `videoComments/${videoId}/${commentId}`);
      await remove(commentRef);

      // Update video's comment count
      const videoRef = ref(database, `videos/${videoId}`);
      const videoSnapshot = await get(videoRef);
      if (videoSnapshot.exists()) {
        const videoData = videoSnapshot.val();
        await set(videoRef, {
          ...videoData,
          comments: Math.max((videoData.comments || 0) - 1, 0), // Ensure count doesn't go below 0
        });
      }

      await fetchComments();
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    );
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                <div className="relative">
                  {/* Header */}
                  <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      Comments
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Comments list */}
                  <div className="px-4 py-3 h-96 overflow-y-auto">
                    {loading ? (
                      <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                      </div>
                    ) : comments.length > 0 ? (
                      <div className="space-y-4">
                        {comments.map((comment) => (
                          <div key={comment.id} className="flex space-x-3">
                            <Link href={`/profile/${comment.userId}`} className="flex-shrink-0">
                              <div className="relative w-8 h-8">
                                <Image
                                  src={comment.userImage}
                                  alt={comment.username}
                                  className="rounded-full object-cover"
                                  fill
                                  sizes="32px"
                                />
                              </div>
                            </Link>
                            <div className="flex-1">
                              <div className="bg-gray-50 rounded-lg px-4 py-2 relative group">
                                <div className="flex items-center justify-between mb-1">
                                  <Link 
                                    href={`/profile/${comment.userId}`}
                                    className="font-medium text-gray-900 hover:text-indigo-600 transition-colors"
                                  >
                                    {comment.username}
                                  </Link>
                                  <span className="text-xs text-gray-500">
                                    {formatDate(comment.createdAt)}
                                  </span>
                                </div>
                                <p className="text-gray-700 text-sm mb-1">{comment.text}</p>
                                {user && user.uid === comment.userId && (
                                  <div className="flex justify-end">
                                    <button
                                      onClick={() => handleDeleteComment(comment.id)}
                                      disabled={submitting}
                                      className="p-1 hover:bg-red-100 rounded-full transition-colors"
                                      title="Delete comment"
                                    >
                                      <svg 
                                        className="w-3.5 h-3.5 text-red-500 hover:text-red-600 transition-colors" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path 
                                          strokeLinecap="round" 
                                          strokeLinejoin="round" 
                                          strokeWidth={2.5} 
                                          d="M6 18L18 6M6 6l12 12"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p>No comments yet</p>
                        <p className="text-sm">Be the first to comment!</p>
                      </div>
                    )}
                  </div>

                  {/* Comment input */}
                  {user ? (
                    <form onSubmit={handleSubmitComment} className="border-t border-gray-200 p-4">
                      <div className="flex items-start space-x-3">
                        <div className="relative w-8 h-8 flex-shrink-0">
                          <Image
                            src={currentUserProfile?.avatarUrl || '/default-avatar.png'}
                            alt={currentUserProfile?.name || user.displayName || 'User'}
                            className="rounded-full object-cover"
                            fill
                            sizes="32px"
                          />
                        </div>
                        <div className="flex-1">
                          <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Add a comment..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                            rows={2}
                          />
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-2">
                              {quickComments.map((comment, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => handleQuickComment(comment)}
                                  disabled={submitting}
                                  className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {comment}
                                </button>
                              ))}
                            </div>
                            <button
                              type="submit"
                              disabled={!newComment.trim() || submitting}
                              className={`px-4 py-2 rounded-lg text-sm font-medium text-white 
                                ${!newComment.trim() || submitting
                                  ? 'bg-gray-300 cursor-not-allowed'
                                  : 'bg-indigo-600 hover:bg-indigo-700'
                                } transition-colors`}
                            >
                              {submitting ? 'Posting...' : 'Post'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <div className="border-t border-gray-200 p-4">
                      <p className="text-center text-gray-500">
                        Please{' '}
                        <Link href="/login" className="text-indigo-600 hover:text-indigo-700">
                          log in
                        </Link>{' '}
                        to comment
                      </p>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}