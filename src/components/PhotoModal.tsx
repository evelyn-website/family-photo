import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { CachedPhoto, usePhotoCache } from "../lib/PhotoCacheContext";

interface PhotoModalProps {
  photoId: Id<"photos">;
  onClose: () => void;
  showEditorialActions?: boolean;
  isInEditorial?: boolean;
  // Optional: pass photo data directly to avoid refetch
  initialPhoto?: CachedPhoto;
}

export function PhotoModal({
  photoId,
  onClose,
  showEditorialActions = false,
  isInEditorial = false,
  initialPhoto,
}: PhotoModalProps) {
  const [newComment, setNewComment] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);

  // Try to get photo from cache first
  const { getPhoto, getCachedImageUrl } = usePhotoCache();
  const cachedPhoto = getPhoto(photoId);

  // Use initialPhoto > cachedPhoto > fetch from server
  const photoFromCache = initialPhoto ?? cachedPhoto;

  // Get cached blob URL for the image (avoids re-downloading the file)
  const cachedImageUrl = getCachedImageUrl(photoId);

  // Only fetch from server if we don't have cached data
  const fetchedPhoto = useQuery(
    api.photos.getPhoto,
    photoFromCache ? "skip" : { photoId }
  );

  // Fetch comments separately (always fetch for real-time updates)
  const comments = useQuery(api.photos.getPhotoComments, { photoId });

  const addComment = useMutation(api.photos.addComment);
  const addToEditorial = useMutation(api.editorial.addToEditorialFeed);
  const removeFromEditorial = useMutation(
    api.editorial.removeFromEditorialFeed
  );

  // The photo to display - prefer cached, fall back to fetched
  const photo = photoFromCache ?? fetchedPhoto;

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // Reset image loaded state when photo changes
  useEffect(() => {
    setImageLoaded(false);
  }, [photoId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await addComment({
        photoId,
        content: newComment.trim(),
      });
      setNewComment("");
      toast.success("Comment added successfully!");
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

  const handleEditorialAction = async () => {
    try {
      if (isInEditorial) {
        await removeFromEditorial({ photoId });
        toast.success("Removed from editorial feed");
      } else {
        await addToEditorial({ photoId });
        toast.success("Added to editorial feed");
      }
    } catch (error) {
      console.error("Failed to update editorial feed:", error);
      toast.error("Failed to update editorial feed");
    }
  };

  // Show loading only if we have no cached data and are still fetching
  if (!photo && fetchedPhoto === undefined) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
        onClick={onClose}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-zinc-300"></div>
      </div>
    );
  }

  if (!photo || !photo.url) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
        onClick={onClose}
      >
        <div className="text-zinc-100 text-lg">Photo not found</div>
      </div>
    );
  }

  const commentsList = comments ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
        aria-label="Close"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Main content container */}
      <div
        className="flex flex-col lg:flex-row max-w-7xl w-full h-[90vh] bg-zinc-900 rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image section */}
        <div className="h-[50vh] lg:h-full lg:flex-1 flex items-center justify-center bg-black relative shrink-0 lg:shrink">
          {/* Skeleton loader */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full border-4 border-zinc-700 border-t-zinc-400 animate-spin" />
                <span className="text-zinc-500 text-sm">Loading image...</span>
              </div>
            </div>
          )}
          <img
            src={cachedImageUrl ?? photo.url ?? ""}
            alt={photo.title}
            className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
          />
        </div>

        {/* Details sidebar */}
        <div className="flex-1 lg:flex-none w-full lg:w-96 flex flex-col bg-zinc-900 border-t lg:border-t-0 lg:border-l border-zinc-800 min-h-0 overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-zinc-800">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-zinc-100 truncate">
                  {photo.title}
                </h2>
                <p className="text-zinc-400 text-sm mt-1">
                  by {photo.user.name}
                </p>
              </div>
              {showEditorialActions && (
                <button
                  onClick={() => void handleEditorialAction()}
                  className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    isInEditorial
                      ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                      : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                  }`}
                >
                  {isInEditorial ? "Remove" : "Add to Editorial"}
                </button>
              )}
            </div>

            {photo.description && (
              <p className="text-zinc-300 text-sm mt-3 leading-relaxed">
                {photo.description}
              </p>
            )}

            {photo.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {photo.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <p className="text-zinc-500 text-xs mt-3">
              {new Date(photo._creationTime).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {/* Comments section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-5 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-300">
                Comments ({commentsList.length})
              </h3>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {comments === undefined ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-zinc-700 border-t-zinc-400"></div>
                </div>
              ) : commentsList.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">
                  No comments yet. Be the first!
                </p>
              ) : (
                commentsList.map((comment) => (
                  <div key={comment._id} className="bg-zinc-800 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium text-zinc-200">
                        {comment.user.name}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(comment._creationTime).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400">{comment.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Comment form */}
            <form
              onSubmit={(e) => void handleAddComment(e)}
              className="p-4 border-t border-zinc-800"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Post
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
