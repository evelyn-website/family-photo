import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

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
  showFavoritesButton?: boolean;
  isInFavorites?: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  hasAnySelection?: boolean;
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
  showFavoritesButton = false,
  isInFavorites = false,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  hasAnySelection = false,
}: PhotoCardProps) {
  const addToEditorial = useMutation(api.editorial.addToEditorialFeed);
  const removeFromEditorial = useMutation(
    api.editorial.removeFromEditorialFeed
  );
  const toggleFavorites = useMutation(api.collections.toggleFavorites);

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

  const handleToggleFavorites = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await toggleFavorites({ photoId: photo._id });
      if (result.added) {
        toast.success("Added to Favorites");
      } else {
        toast.success("Removed from Favorites");
      }
    } catch (error) {
      console.error("Failed to toggle favorites:", error);
      toast.error("Failed to update favorites");
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const url = `${window.location.origin}?view=feed&photo=${photo._id}`;
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch (error) {
      console.error("Failed to copy link:", error);
      toast.error("Failed to copy link");
    }
  };

  if (!photo.url) {
    return null;
  }

  const handleClick = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect();
    } else if (onClick) {
      onClick();
    }
  };

  const checkboxSize = hasAnySelection ? "w-6 h-6" : "w-4 h-4";
  const checkboxOpacity = hasAnySelection ? "opacity-100" : "opacity-50";

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
      <div
        className={`relative overflow-hidden shrink-0 ${onClick || isSelectionMode ? "cursor-pointer group" : ""}`}
        onClick={handleClick}
      >
        <img
          src={photo.url}
          alt={photo.title}
          className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* Selection checkbox overlay */}
        {(isSelectionMode || hasAnySelection) && (
          <div
            className={`absolute top-2 left-2 ${checkboxSize} ${checkboxOpacity} transition-all duration-200 z-10`}
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleSelect) {
                onToggleSelect();
              }
            }}
          >
            <div
              className={`w-full h-full rounded-full border-2 flex items-center justify-center transition-all ${
                isSelected
                  ? "bg-indigo-600 border-indigo-600"
                  : "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600"
              }`}
            >
              {isSelected && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-white"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
          </div>
        )}
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

      <div className="p-4 flex flex-col flex-1 min-h-[200px]">
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
              {isInEditorial ? "Remove from Editorial" : "Add to Editorial"}
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
          <p className="text-zinc-700 dark:text-zinc-300 text-sm mb-3 line-clamp-2 overflow-hidden">
            {photo.description}
          </p>
        )}

        {photo.tags.length > 0 && (
          <div className="flex gap-1 mb-3 overflow-x-auto overflow-y-hidden max-h-16 scroll-smooth shrink-0">
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
                  className={`flex-shrink-0 px-2 py-1 text-xs rounded-full transition-colors ${
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

        <div className="flex-grow"></div>

        <div className="flex justify-between items-center shrink-0">
          <div className="text-sm text-zinc-500 dark:text-zinc-500">
            <span>{new Date(photo._creationTime).toLocaleDateString()}</span>
          </div>
          <div className="flex gap-2">
            {showFavoritesButton && (
              <button
                onClick={(e) => void handleToggleFavorites(e)}
                className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                aria-label={
                  isInFavorites ? "Remove from Favorites" : "Add to Favorites"
                }
              >
                {isInFavorites ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-rose-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                )}
              </button>
            )}
            {/* Copy link button */}
            <button
              onClick={(e) => void handleCopyLink(e)}
              className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              aria-label="Copy link to photo"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
