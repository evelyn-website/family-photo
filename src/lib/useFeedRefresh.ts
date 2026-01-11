import { useCallback } from "react";
import { usePhotoCache } from "./usePhotoCache";
import { usePullToRefresh } from "./usePullToRefresh";

interface UseFeedRefreshOptions {
  cacheKey?: string;
  onRefresh?: () => void;
}

/**
 * Shared hook for pull-to-refresh functionality across feed components.
 * Handles cache invalidation and refresh state management.
 */
export function useFeedRefresh({
  cacheKey,
  onRefresh,
}: UseFeedRefreshOptions) {
  const { invalidateCacheKey } = usePhotoCache();

  const handleRefresh = useCallback(() => {
    if (cacheKey) {
      invalidateCacheKey(cacheKey);
    } else if (onRefresh) {
      onRefresh();
    }
  }, [cacheKey, invalidateCacheKey, onRefresh]);

  return usePullToRefresh({ onRefresh: handleRefresh });
}
