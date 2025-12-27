import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface Photo {
  _id: Id<"photos">;
  title: string;
  description?: string;
  tags: string[];
  url: string | null;
  userId: Id<"users">;
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
  onClick?: () => void;
  onUserClick?: (userId: Id<"users">) => void;
  selectedTags?: string[];
  onAddTag?: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
}

export function PhotoCard({
  photo,
  showEditorialActions = false,
  isInEditorial = false,
  onClick,
  onUserClick,
  selectedTags = [],
  onAddTag,
  onRemoveTag,
}: PhotoCardProps) {
  const addToEditorial = useMutation(api.editorial.addToEditorialFeed);
  const removeFromEditorial = useMutation(
    api.editorial.removeFromEditorialFeed
  );

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
          by{" "}
          {onUserClick ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUserClick(photo.userId);
              }}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline font-medium transition-colors"
            >
              {photo.user.name}
            </button>
          ) : (
            <span>{photo.user.name}</span>
          )}
        </p>

        {photo.description && (
          <p className="text-zinc-700 dark:text-zinc-300 text-sm mb-3">
            {photo.description}
          </p>
        )}

        {photo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {photo.tags.map((tag, index) => {
              const normalizedTag = tag.toLowerCase();
              const isSelected = selectedTags.includes(normalizedTag);
              const handleTagClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (isSelected) {
                  onRemoveTag?.(normalizedTag);
                } else {
                  onAddTag?.(normalizedTag);
                }
              };

              return (
                <span
                  key={index}
                  onClick={handleTagClick}
                  className={`px-2 py-1 text-xs rounded-full transition-colors ${
                    onAddTag || onRemoveTag
                      ? isSelected
                        ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/70 cursor-pointer"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  #{tag}
                </span>
              );
            })}
          </div>
        )}

        <div className="text-sm text-zinc-500 dark:text-zinc-500">
          <span>{new Date(photo._creationTime).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
