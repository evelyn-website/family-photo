import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface BulkAddToEditorialDialogProps {
  photoIds: Id<"photos">[];
  onClose: () => void;
}

export function BulkAddToEditorialDialog({
  photoIds,
  onClose,
}: BulkAddToEditorialDialogProps) {
  const currentPeriod = useQuery(api.editorial.getCurrentEditorialPeriod);
  const bulkAddPhotos = useMutation(api.editorial.bulkAddPhotosToEditorial);

  const handleAddToEditorial = async () => {
    if (!currentPeriod) {
      toast.error("No active editorial period");
      return;
    }

    try {
      const result = await bulkAddPhotos({ photoIds });

      toast.success(
        `Added ${result.addedCount} photo${
          result.addedCount !== 1 ? "s" : ""
        } to editorial feed`
      );
      if (result.skippedCount > 0) {
        toast.info(
          `${result.skippedCount} photo${
            result.skippedCount !== 1 ? "s were" : " was"
          } already in the editorial feed`
        );
      }

      onClose();
    } catch (error: any) {
      console.error("Failed to add photos to editorial:", error);
      toast.error(error.message || "Failed to add photos to editorial");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Add {photoIds.length} Photo{photoIds.length !== 1 ? "s" : ""} to
              Editorial
            </h2>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
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
            </button>
          </div>

          {currentPeriod ? (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                Are you sure you want to add {photoIds.length} photo
                {photoIds.length !== 1 ? "s" : ""} to the editorial feed? This
                will feature them in the curated editorial section.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleAddToEditorial()}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Add to Editorial
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                There is no active editorial period. Please create an editorial
                period first before adding photos.
              </p>

              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
