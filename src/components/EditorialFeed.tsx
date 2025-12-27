import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PhotoCard } from "./PhotoCard";

export function EditorialFeed() {
  const photos = useQuery(api.editorial.getEditorialFeed);
  const currentPeriod = useQuery(api.editorial.getCurrentEditorialPeriod);
  const isCurrentCurator = useQuery(api.editorial.isCurrentCurator);

  if (photos === undefined || currentPeriod === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentPeriod) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No active editorial period</h3>
        <p className="text-gray-600">Check back later for curated content!</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Editorial Feed</h2>
        <p className="text-gray-600">
          Curated by <span className="font-medium">{currentPeriod.curator.name}</span>
          {isCurrentCurator && (
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              You're the curator
            </span>
          )}
        </p>
        {isCurrentCurator && (
          <p className="text-sm text-blue-600 mt-1">
            Browse the main feed to add photos to your editorial selection
          </p>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No photos selected yet</h3>
          <p className="text-gray-600">
            {isCurrentCurator 
              ? "Start curating by adding photos from the main feed!"
              : "The curator hasn't selected any photos yet."
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.map((photo) => 
            photo && (
              <PhotoCard 
                key={photo._id} 
                photo={photo} 
                showEditorialActions={isCurrentCurator}
                isInEditorial={true}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
