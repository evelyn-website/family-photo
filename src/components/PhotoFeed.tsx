import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PhotoCard } from "./PhotoCard";

export function PhotoFeed() {
  const photos = useQuery(api.photos.getChronologicalFeed);
  const isCurrentCurator = useQuery(api.editorial.isCurrentCurator);

  if (photos === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No photos yet</h3>
        <p className="text-gray-600">Be the first to share your art!</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">All Photos</h2>
      {isCurrentCurator && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>You're the current curator!</strong> Click "Add to Editorial" on photos to feature them.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {photos.map((photo) => (
          <PhotoCard 
            key={photo._id} 
            photo={photo} 
            showEditorialActions={isCurrentCurator}
            isInEditorial={false}
          />
        ))}
      </div>
    </div>
  );
}
