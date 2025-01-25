import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../lib/firebase/config';
import { ref, push, set, get, query, orderByChild, remove } from 'firebase/database';

interface Reply extends Omit<Comment, 'replies'> {
  parentCommentId: string;
}

interface Comment {
  id: string;
  userId: string;
  username: string;
  userImage: string;
  text: string;
  createdAt: string;
  likes?: number;
  likedBy?: Record<string, boolean>;
  replies?: Reply[];
  replyCount?: number;
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
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
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

          // Fetch and process replies if they exist
          const replies: Reply[] = [];
          if (commentData.replies) {
            for (const [replyId, reply] of Object.entries(commentData.replies)) {
              const replyData = reply as any;
              const replyUserProfileRef = ref(database, `users/${replyData.userId}/profile`);
              const replyUserSnapshot = await get(replyUserProfileRef);
              const replyUserProfile = replyUserSnapshot.val();

              replies.push({
                id: replyId,
                userId: replyData.userId,
                username: replyUserProfile?.name || 'Anonymous',
                userImage: replyUserProfile?.avatarUrl || '/default-avatar.png',
                text: replyData.text,
                createdAt: replyData.createdAt,
                likes: replyData.likes,
                likedBy: replyData.likedBy,
                parentCommentId: id
              });
            }
          }

          // Sort replies by date
          replies.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          fetchedComments.push({
            id,
            userId: commentData.userId,
            username: userProfile?.name || 'Anonymous',
            userImage: userProfile?.avatarUrl || '/default-avatar.png',
            text: commentData.text,
            createdAt: commentData.createdAt,
            likes: commentData.likes,
            likedBy: commentData.likedBy,
            replies,
            replyCount: commentData.replyCount || 0
          });
        }
      }
      // Sort comments by createdAt in memory
      fetchedComments.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setComments(fetchedComments);
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

  const handleDeleteComment = async (commentId: string, parentCommentId?: string) => {
    if (!user) return;
    
    try {
      setSubmitting(true);
      
      if (parentCommentId) {
        // Delete the reply
        const replyRef = ref(database, `videoComments/${videoId}/${parentCommentId}/replies/${commentId}`);
        await remove(replyRef);

        // Update parent comment's reply count
        const commentRef = ref(database, `videoComments/${videoId}/${parentCommentId}`);
        const commentSnapshot = await get(commentRef);
        if (commentSnapshot.exists()) {
          const commentData = commentSnapshot.val();
          await set(commentRef, {
            ...commentData,
            replyCount: Math.max((commentData.replyCount || 0) - 1, 0)
          });
        }
      } else {
        // Delete the main comment
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

  const handleLikeComment = async (commentId: string, parentCommentId?: string) => {
    if (!user) return;
    
    try {
      setSubmitting(true);
      // If parentCommentId exists, this is a reply
      const basePath = parentCommentId 
        ? `videoComments/${videoId}/${parentCommentId}/replies/${commentId}`
        : `videoComments/${videoId}/${commentId}`;
      
      const likedByRef = ref(database, `${basePath}/likedBy/${user.uid}`);
      const likesRef = ref(database, `${basePath}/likes`);
      
      const snapshot = await get(likedByRef);
      const isLiked = snapshot.exists();
      
      // Optimistically update the UI
      setComments(prevComments => 
        prevComments.map(comment => {
          if (parentCommentId && comment.id === parentCommentId) {
            // Update reply within parent comment
            return {
              ...comment,
              replies: comment.replies?.map(reply => {
                if (reply.id === commentId) {
                  const newLikes = isLiked ? (reply.likes || 1) - 1 : (reply.likes || 0) + 1;
                  const newLikedBy = reply.likedBy ? { ...reply.likedBy } : {};
                  
                  if (isLiked) {
                    delete newLikedBy[user.uid];
                  } else {
                    newLikedBy[user.uid] = true;
                  }
                  
                  return {
                    ...reply,
                    likes: newLikes,
                    likedBy: newLikedBy
                  };
                }
                return reply;
              }) || []
            };
          } else if (!parentCommentId && comment.id === commentId) {
            // Update main comment
            const newLikes = isLiked ? (comment.likes || 1) - 1 : (comment.likes || 0) + 1;
            const newLikedBy = comment.likedBy ? { ...comment.likedBy } : {};
            
            if (isLiked) {
              delete newLikedBy[user.uid];
            } else {
              newLikedBy[user.uid] = true;
            }
            
            return {
              ...comment,
              likes: newLikes,
              likedBy: newLikedBy
            };
          }
          return comment;
        })
      );
      
      // Update the database in the background
      if (isLiked) {
        // Unlike
        await set(likedByRef, null);
        await set(likesRef, parentCommentId
          ? (comments.find(c => c.id === parentCommentId)?.replies?.find(r => r.id === commentId)?.likes || 1) - 1
          : (comments.find(c => c.id === commentId)?.likes || 1) - 1
        );
      } else {
        // Like
        await set(likedByRef, true);
        await set(likesRef, parentCommentId
          ? (comments.find(c => c.id === parentCommentId)?.replies?.find(r => r.id === commentId)?.likes || 0) + 1
          : (comments.find(c => c.id === commentId)?.likes || 0) + 1
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert the optimistic update on error
      await fetchComments();
    } finally {
      setSubmitting(false);
    }
  };

  const isCommentLiked = (comment: Comment) => {
    return comment.likedBy?.[user?.uid || ''] || false;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    );
  };

  const handleReply = async (parentCommentId: string, replyText: string) => {
    if (!user || !replyText.trim() || submitting) return;

    try {
      setSubmitting(true);
      const repliesRef = ref(database, `videoComments/${videoId}/${parentCommentId}/replies`);
      const newReplyRef = push(repliesRef);
      
      await set(newReplyRef, {
        userId: user.uid,
        text: replyText.trim(),
        createdAt: new Date().toISOString(),
        parentCommentId
      });

      // Update reply count
      const commentRef = ref(database, `videoComments/${videoId}/${parentCommentId}`);
      const commentSnapshot = await get(commentRef);
      if (commentSnapshot.exists()) {
        const commentData = commentSnapshot.val();
        await set(commentRef, {
          ...commentData,
          replyCount: (commentData.replyCount || 0) + 1
        });
      }

      setReplyingTo(null);
      await fetchComments();
    } catch (error) {
      console.error('Error posting reply:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
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
              <Dialog.Panel className="w-full max-w-[600px] transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
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
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    <button
                                      onClick={() => handleLikeComment(comment.id)}
                                      disabled={submitting}
                                      className="flex items-center space-x-1 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
                                    >
                                      {isCommentLiked(comment) ? (
                                        <svg className="w-4 h-4 fill-indigo-600" viewBox="0 0 20 20">
                                          <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                        </svg>
                                      )}
                                      <span>{comment.likes || 0}</span>
                                    </button>
                                    {user && (
                                      <button
                                        onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                                        className="flex items-center space-x-1 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                        <span>Reply</span>
                                      </button>
                                    )}
                                  </div>
                                  {user && user.uid === comment.userId && (
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
                                  )}
                                </div>
                                
                                {/* Reply Input */}
                                {replyingTo === comment.id && user && (
                                  <div className="mt-3 flex items-start space-x-2">
                                    <div className="relative w-6 h-6 flex-shrink-0">
                                      <Image
                                        src={currentUserProfile?.avatarUrl || '/default-avatar.png'}
                                        alt={currentUserProfile?.name || user.displayName || 'User'}
                                        className="rounded-full object-cover"
                                        fill
                                        sizes="24px"
                                      />
                                    </div>
                                    <form 
                                      className="flex-1"
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        const form = e.target as HTMLFormElement;
                                        const input = form.elements.namedItem('reply') as HTMLInputElement;
                                        handleReply(comment.id, input.value);
                                        input.value = '';
                                      }}
                                    >
                                      <input
                                        name="reply"
                                        className="w-full px-3 py-1 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder={`Reply to ${comment.username}...`}
                                        disabled={submitting}
                                      />
                                    </form>
                                  </div>
                                )}

                                {/* Replies Section */}
                                {(comment.replyCount || 0) > 0 && (
                                  <div className="mt-2">
                                    <button
                                      onClick={() => toggleReplies(comment.id)}
                                      className="flex items-center space-x-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                                    >
                                      <svg 
                                        className={`w-4 h-4 transform transition-transform ${expandedComments.has(comment.id) ? 'rotate-180' : ''}`} 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                      <span>
                                        {expandedComments.has(comment.id) 
                                          ? 'Hide replies' 
                                          : `Show ${comment.replyCount || 0} ${(comment.replyCount || 0) === 1 ? 'reply' : 'replies'}`
                                        }
                                      </span>
                                    </button>

                                    {/* Replies List */}
                                    {expandedComments.has(comment.id) && comment.replies && (
                                      <div className="mt-2 space-y-3 pl-4 border-l-2 border-gray-100">
                                        {comment.replies.map((reply) => (
                                          <div key={reply.id} className="flex space-x-2">
                                            <Link href={`/profile/${reply.userId}`} className="flex-shrink-0">
                                              <div className="relative w-6 h-6">
                                                <Image
                                                  src={reply.userImage}
                                                  alt={reply.username}
                                                  className="rounded-full object-cover"
                                                  fill
                                                  sizes="24px"
                                                />
                                              </div>
                                            </Link>
                                            <div className="flex-1">
                                              <div className="bg-gray-50 rounded-lg px-3 py-2">
                                                <div className="flex items-center justify-between mb-1">
                                                  <Link 
                                                    href={`/profile/${reply.userId}`}
                                                    className="font-medium text-sm text-gray-900 hover:text-indigo-600 transition-colors"
                                                  >
                                                    {reply.username}
                                                  </Link>
                                                  <span className="text-xs text-gray-500">
                                                    {formatDate(reply.createdAt)}
                                                  </span>
                                                </div>
                                                <p className="text-gray-700 text-sm">{reply.text}</p>
                                                <div className="flex items-center justify-between mt-1">
                                                  <button
                                                    onClick={() => handleLikeComment(reply.id, reply.parentCommentId)}
                                                    disabled={submitting}
                                                    className="flex items-center space-x-1 text-xs text-gray-500 hover:text-indigo-600 transition-colors"
                                                  >
                                                    {isCommentLiked(reply) ? (
                                                      <svg className="w-3 h-3 fill-indigo-600" viewBox="0 0 20 20">
                                                        <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                                                      </svg>
                                                    ) : (
                                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                                      </svg>
                                                    )}
                                                    <span>{reply.likes || 0}</span>
                                                  </button>
                                                  {user && user.uid === reply.userId && (
                                                    <button
                                                      onClick={() => handleDeleteComment(reply.id, reply.parentCommentId)}
                                                      disabled={submitting}
                                                      className="p-1 hover:bg-red-100 rounded-full transition-colors"
                                                      title="Delete reply"
                                                    >
                                                      <svg 
                                                        className="w-3 h-3 text-red-500 hover:text-red-600 transition-colors" 
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
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
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