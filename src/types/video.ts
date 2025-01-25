export interface Video {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  userId: string;
  username: string;
  userImage: string;
  createdAt: string;
  likes: number;
  comments: number;
  shares: number;
  likedBy?: Record<string, boolean>;
  views: number;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  userImage: string;
  text: string;
  createdAt: number;
} 