import { useState, useEffect, useRef, useCallback } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => void;
  threshold?: number;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
}: UsePullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const startY = useRef(0);
  const isDragging = useRef(false);
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const isAtTop = useCallback(() => window.scrollY <= 5, []);

  useEffect(() => {
    if (!("ontouchstart" in window)) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (!isAtTop()) return;
      startY.current = e.touches[0].clientY;
      isDragging.current = true;
      setIsPulling(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      
      const distance = Math.max(0, e.touches[0].clientY - startY.current);
      pullDistanceRef.current = distance;
      setPullDistance(distance);
      
      if (distance > 0 && isAtTop()) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging.current) return;
      
      if (pullDistanceRef.current >= threshold && isAtTop()) {
        onRefreshRef.current();
      }
      
      // Reset immediately
      isDragging.current = false;
      pullDistanceRef.current = 0;
      setIsPulling(false);
      setPullDistance(0);
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [threshold, isAtTop]);

  return { isPulling, pullDistance };
}
