import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface Photo {
  _id: Id<"photos">;
  title: string;
  description?: string;
  tags: string[];
  url: string | null;
  user: {
    name: string;
    email?: string;
  };
  _creationTime: number;
}

interface Comment {
  _id: Id<"comments">;
  photoId: Id<"photos">;
  userId?: Id<"users">;
  content: string;
  user: {
    name: string;
  };
  _creationTime: number;
}

interface PhotoCardProps {
  photo: Photo;
  showEditorialActions?: boolean;
  isInEditorial?: boolean;
  onClick?: () => void;
}

export function PhotoCard({
  photo,
  showEditorialActions = false,
  isInEditorial = false,
  onClick,
}: PhotoCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");

  const addComment = useMutation(api.photos.addComment);
  const addToEditorial = useMutation(api.editorial.addToEditorialFeed);
  const removeFromEditorial = useMutation(
    api.editorial.removeFromEditorialFeed
  );

  // Fetch only comments when comments section is shown (uses separate cached query)
  const photoComments = useQuery(
    api.photos.getPhotoComments,
    showComments ? { photoId: photo._id } : "skip"
  );

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await addComment({
        photoId: photo._id,
        content: newComment.trim(),
      });
      setNewComment("");
      toast.success("Comment added successfully!");
      // Comments will automatically refresh via the query
    } catch (error) {
      console.error("Failed to add comment:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add comment";
      if (
        errorMessage.includes("Not authenticated") ||
        errorMessage.includes("authenticated")
      ) {
        toast.error("Please sign in to add a comment");
      } else {
        toast.error("Failed to add comment. Please try again.");
      }
    }
  };

  const comments = photoComments ?? [];

  const handleEditorialAction = async () => {
    try {
      if (isInEditorial) {
        await removeFromEditorial({ photoId: photo._id });
      } else {
        await addToEditorial({ photoId: photo._id });
      }
    } catch (error) {
      console.error("Failed to update editorial feed:", error);
    }
  };

  if (!photo.url) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div
        className={`relative overflow-hidden ${onClick ? "cursor-pointer group" : ""}`}
        onClick={onClick}
      >
        <img
          src={photo.url}
          alt={photo.title}
          className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {onClick && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/60 rounded-full p-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                />
              </svg>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            {photo.title}
          </h3>
          {showEditorialActions && (
            <button
              onClick={() => void handleEditorialAction()}
              className={`px-2 py-1 text-xs rounded-full transition-colors ${
                isInEditorial
                  ? "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/70"
                  : "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/70"
              }`}
            >
              {isInEditorial ? "Remove" : "Add to Editorial"}
            </button>
          )}
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
          by {photo.user.name}
        </p>

        {photo.description && (
          <p className="text-zinc-700 dark:text-zinc-300 text-sm mb-3">
            {photo.description}
          </p>
        )}

        {photo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {photo.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center text-sm text-zinc-500 dark:text-zinc-500">
          <span>{new Date(photo._creationTime).toLocaleDateString()}</span>
          <button
            onClick={() => setShowComments(!showComments)}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
          >
            {showComments ? "Hide" : "Show"} Comments
          </button>
        </div>

        {showComments && (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            {/* Display existing comments */}
            {photoComments === undefined ? (
              <div className="text-center py-4 text-zinc-500 dark:text-zinc-500 text-sm">
                Loading comments...
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-4 text-zinc-500 dark:text-zinc-500 text-sm">
                No comments yet. Be the first to comment!
              </div>
            ) : (
              <div className="mb-4 space-y-3">
                {comments.map((comment: Comment) => (
                  <div
                    key={comment._id}
                    className="bg-zinc-50 dark:bg-zinc-800 rounded-md p-3"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {comment.user.name}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-500">
                        {new Date(comment._creationTime).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {comment.content}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Comment form */}
            <form onSubmit={(e) => void handleAddComment(e)} className="mb-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Post
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
