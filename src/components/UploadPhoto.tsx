import { useState, useRef } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { usePhotoCache } from "../lib/usePhotoCache";
import { generateImageVersions, formatFileSize } from "../lib/imageCompression";

export function UploadPhoto() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [isNSFW, setIsNSFW] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const uploadPhoto = useAction(api.photos.uploadPhoto);
  const uploadMaintenance = useQuery(api.photos.getPhotoUploadMaintenance);
  const { invalidateCacheKey } = usePhotoCache();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // No size limit check - compression will handle large files
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedImage || !title.trim()) {
      toast.error("Please provide a title and select an image");
      return;
    }
    if (uploadMaintenance?.enabled) {
      toast.error(
        uploadMaintenance.message || "Photo uploads are temporarily unavailable"
      );
      return;
    }

    setIsUploading(true);

    try {
      // Step 1: Generate three versions (thumbnail, medium, original)
      const versions = await generateImageVersions(selectedImage);

      // Step 2: Get upload URLs for all three versions
      const thumbnailUploadUrl = await generateUploadUrl();
      const mediumUploadUrl = await generateUploadUrl();
      const originalUploadUrl = await generateUploadUrl();

      // Step 3: Upload thumbnail
      const thumbnailResult = await fetch(thumbnailUploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: versions.thumbnail,
      });
      const thumbnailJson = await thumbnailResult.json();
      if (!thumbnailResult.ok) {
        throw new Error(
          `Thumbnail upload failed: ${JSON.stringify(thumbnailJson)}`
        );
      }
      const thumbnailStorageId = thumbnailJson.storageId;

      // Step 4: Upload medium
      const mediumResult = await fetch(mediumUploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: versions.medium,
      });
      const mediumJson = await mediumResult.json();
      if (!mediumResult.ok) {
        throw new Error(`Medium upload failed: ${JSON.stringify(mediumJson)}`);
      }
      const mediumStorageId = mediumJson.storageId;

      // Step 5: Upload original (untouched file)
      const originalResult = await fetch(originalUploadUrl, {
        method: "POST",
        headers: { "Content-Type": versions.original.type },
        body: versions.original,
      });
      const originalJson = await originalResult.json();
      if (!originalResult.ok) {
        throw new Error(
          `Original upload failed: ${JSON.stringify(originalJson)}`
        );
      }
      const originalStorageId = originalJson.storageId;

      // Step 6: Save photo metadata with all three storage IDs
      const tagArray = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      await uploadPhoto({
        thumbnailStorageId,
        mediumStorageId,
        originalStorageId,
        title: title.trim(),
        description: description.trim() || undefined,
        tags: tagArray,
        isNSFW: isNSFW || undefined,
      });

      // Invalidate page 1 cache so the feed will refetch and show the new photo at the top
      // This is more efficient than invalidating all cache - only page 1 needs to refresh
      invalidateCacheKey("mainFeed-page-1");

      // Reset form
      setTitle("");
      setDescription("");
      setTags("");
      setIsNSFW(false);
      setSelectedImage(null);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      toast.success("Photo uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      // Show specific error message if available, otherwise generic message
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload photo";
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Upload Photo
      </h2>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Image
          </label>
          <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 text-center hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors bg-white dark:bg-zinc-900">
            {previewUrl ? (
              <div className="space-y-4">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full max-h-64 mx-auto rounded-lg"
                />
                {selectedImage && (
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    File size: {formatFileSize(selectedImage.size)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="text-sm text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                >
                  Remove image
                </button>
              </div>
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Choose Image
                </button>
                <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-2">
                  PNG, JPG, GIF (any size - automatic compression)
                </p>
              </div>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
          >
            Title *
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            placeholder="Give your photo a title"
            required
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
          >
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            placeholder="Describe your photo (optional)"
          />
        </div>

        <div>
          <label
            htmlFor="tags"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
          >
            Tags
          </label>
          <input
            type="text"
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            placeholder="film, digital, black-and-white, color (separate with commas)"
          />
          <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
            Separate tags with commas
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isNSFW}
              onChange={(e) => setIsNSFW(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-zinc-300 dark:border-zinc-600 rounded focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-zinc-800"
            />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Mark as NSFW
            </span>
          </label>
          <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1 ml-6">
            This photo will be blurred by default
          </p>
        </div>

        <button
          type="submit"
          disabled={
            isUploading ||
            !selectedImage ||
            !title.trim() ||
            uploadMaintenance?.enabled
          }
          className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploadMaintenance?.enabled
            ? "Uploads Temporarily Disabled"
            : isUploading
              ? "Uploading..."
              : "Upload Photo"}
        </button>
        {uploadMaintenance?.enabled && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            {uploadMaintenance.message || "Uploads are paused during maintenance."}
          </p>
        )}
      </form>
    </div>
  );
}
