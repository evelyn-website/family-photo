import { useContext } from "react";
import { PhotoCacheContext } from "./PhotoCacheContextInstance";
import type { PhotoCacheContextType } from "./PhotoCacheContextInstance";

export function usePhotoCache(): PhotoCacheContextType {
  const context = useContext(PhotoCacheContext);
  if (!context) {
    throw new Error("usePhotoCache must be used within a PhotoCacheProvider");
  }
  return context;
}

