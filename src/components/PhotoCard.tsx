import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

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

interface PhotoCardProps {
  photo: Photo;
  showEditorialActions?: boolean;
  isInEditorial?: boolean;
}

export function PhotoCard({ photo, showEditorialActions = false, isInEditorial = false }: PhotoCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  
  const addComment = useMutation(api.photos.addComment);
  const addToEditorial = useMutation(api.editorial.addToEditorialFeed);
  const removeFromEditorial = useMutation(api.editorial.removeFromEditorialFeed);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await addComment({
        photoId: photo._id,
        content: newComment.trim(),
      });
      setNewComment("");
    } catch (error) {
      console.error("Failed to add comment:", error);
    }
  };

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
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <img
        src={photo.url}
        alt={photo.title}
        className="w-full h-64 object-cover"
      />
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-gray-900">{photo.title}</h3>
          {showEditorialActions && (
            <button
              onClick={handleEditorialAction}
              className={`px-2 py-1 text-xs rounded-full transition-colors ${
                isInEditorial
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
              }`}
            >
              {isInEditorial ? "Remove" : "Add to Editorial"}
            </button>
          )}
        </div>
        
        <p className="text-sm text-gray-600 mb-2">by {photo.user.name}</p>
        
        {photo.description && (
          <p className="text-gray-700 text-sm mb-3">{photo.description}</p>
        )}
        
        {photo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {photo.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
        
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>{new Date(photo._creationTime).toLocaleDateString()}</span>
          <button
            onClick={() => setShowComments(!showComments)}
            className="text-blue-600 hover:text-blue-700"
          >
            {showComments ? "Hide" : "Show"} Comments
          </button>
        </div>
        
        {showComments && (
          <div className="mt-4 pt-4 border-t">
            <form onSubmit={handleAddComment} className="mb-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
