import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface BulkAddToCollectionDialogProps {
  photoIds: Id<"photos">[];
  onClose: () => void;
}

export function BulkAddToCollectionDialog({
  photoIds,
  onClose,
}: BulkAddToCollectionDialogProps) {
  const [selectedCollections, setSelectedCollections] = useState<
    Set<Id<"collections">>
  >(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [newCollectionIsPublic, setNewCollectionIsPublic] = useState(true);

  const currentUser = useQuery(api.auth.loggedInUser);
  const userCollections = useQuery(
    api.collections.getUserCollections,
    currentUser ? { userId: currentUser._id } : "skip"
  );

  const bulkAddPhotos = useMutation(api.collections.bulkAddPhotosToCollection);
  const createAndAddPhotos = useMutation(
    api.collections.createCollectionAndAddPhotos
  );

  const handleToggleCollection = (collectionId: Id<"collections">) => {
    const newSet = new Set(selectedCollections);
    if (newSet.has(collectionId)) {
      newSet.delete(collectionId);
    } else {
      newSet.add(collectionId);
    }
    setSelectedCollections(newSet);
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCollectionName.trim()) {
      toast.error("Please provide a collection name");
      return;
    }

    try {
      const result = await createAndAddPhotos({
        name: newCollectionName.trim(),
        description: newCollectionDescription.trim() || undefined,
        isPublic: newCollectionIsPublic,
        photoIds,
      });

      toast.success(
        `Created collection and added ${result.addedCount} photo${
          result.addedCount !== 1 ? "s" : ""
        }`
      );
      if (result.skippedCount > 0) {
        toast.info(
          `${result.skippedCount} photo${
            result.skippedCount !== 1 ? "s were" : " was"
          } already in the collection`
        );
      }

      setShowCreateForm(false);
      setNewCollectionName("");
      setNewCollectionDescription("");
      setNewCollectionIsPublic(true);
      onClose();
    } catch (error: any) {
      console.error("Failed to create collection and add photos:", error);
      toast.error(error.message || "Failed to create collection");
    }
  };

  const handleAddToSelected = async () => {
    if (selectedCollections.size === 0) {
      toast.error("Please select at least one collection");
      return;
    }

    try {
      let totalAdded = 0;
      let totalSkipped = 0;

      for (const collectionId of selectedCollections) {
        const result = await bulkAddPhotos({
          collectionId,
          photoIds,
        });
        totalAdded += result.addedCount;
        totalSkipped += result.skippedCount;
      }

      toast.success(
        `Added ${totalAdded} photo${totalAdded !== 1 ? "s" : ""} to ${
          selectedCollections.size
        } collection${selectedCollections.size !== 1 ? "s" : ""}`
      );
      if (totalSkipped > 0) {
        toast.info(
          `${totalSkipped} photo${
            totalSkipped !== 1 ? "s were" : " was"
          } already in some collections`
        );
      }

      onClose();
    } catch (error: any) {
      console.error("Failed to add photos to collections:", error);
      toast.error(error.message || "Failed to add photos to collections");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Add {photoIds.length} Photo{photoIds.length !== 1 ? "s" : ""} to
              Collection
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

          {!showCreateForm ? (
            <>
              <div className="mb-4">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Select Collections
                </h3>
                {userCollections && userCollections.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {userCollections.map((collection) => (
                      <label
                        key={collection._id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCollections.has(collection._id)}
                          onChange={() =>
                            handleToggleCollection(collection._id)
                          }
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-600 rounded"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {collection.name}
                            {collection.isDefault && (
                              <span className="ml-2 text-xs text-zinc-500">
                                (Default)
                              </span>
                            )}
                          </div>
                          {collection.description && (
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                              {collection.description}
                            </div>
                          )}
                          <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                            {collection.photoCount} photos
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    You don't have any collections yet. Create one below.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  Create New Collection
                </button>
                <button
                  onClick={() => void handleAddToSelected()}
                  disabled={selectedCollections.size === 0}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add to Selected ({selectedCollections.size})
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={(e) => void handleCreateAndAdd(e)}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Collection name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newCollectionDescription}
                    onChange={(e) =>
                      setNewCollectionDescription(e.target.value)
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Describe your collection (optional)"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="newIsPublic"
                    checked={newCollectionIsPublic}
                    onChange={(e) => setNewCollectionIsPublic(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-600 rounded"
                  />
                  <label
                    htmlFor="newIsPublic"
                    className="ml-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    Make this collection public
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewCollectionName("");
                      setNewCollectionDescription("");
                      setNewCollectionIsPublic(true);
                    }}
                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Create and Add Photos
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
