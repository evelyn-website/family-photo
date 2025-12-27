import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface BulkActionMenuProps {
  selectedCount: number;
  selectedPhotoIds: Id<"photos">[];
  onAddToCollection: () => void;
  onAddToEditorial?: () => void;
  onRemoveFromEditorial?: () => void;
  onCopyLinks: (photoIds: Id<"photos">[]) => void;
}

export function BulkActionMenu({
  selectedCount,
  selectedPhotoIds,
  onAddToCollection,
  onAddToEditorial,
  onRemoveFromEditorial,
  onCopyLinks,
}: BulkActionMenuProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isCurrentCurator = useQuery(api.editorial.isCurrentCurator);

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Expanded menu */}
      {isExpanded && (
        <div className="mb-2 flex flex-col gap-2 animate-in slide-in-from-bottom-2">
          <button
            onClick={() => {
              onCopyLinks(selectedPhotoIds);
              setIsExpanded(false);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <span>Copy Links</span>
          </button>
          <button
            onClick={() => {
              onAddToCollection();
              setIsExpanded(false);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <span>Add to Collection</span>
          </button>
          {onAddToEditorial && isCurrentCurator && (
            <button
              onClick={() => {
                onAddToEditorial();
                setIsExpanded(false);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
              <span>Add to Editorial</span>
            </button>
          )}
          {onRemoveFromEditorial && isCurrentCurator && (
            <button
              onClick={() => {
                onRemoveFromEditorial();
                setIsExpanded(false);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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
              <span>Remove from Editorial</span>
            </button>
          )}
        </div>
      )}

      {/* Main floating button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-lg flex items-center gap-2 transition-all hover:scale-105"
        aria-label="Bulk actions"
      >
        {isExpanded ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
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
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
            />
          </svg>
        )}
        {selectedCount > 0 && (
          <span className="bg-white text-indigo-600 rounded-full px-2 py-1 text-sm font-semibold min-w-[24px] text-center">
            {selectedCount}
          </span>
        )}
      </button>
    </div>
  );
}
