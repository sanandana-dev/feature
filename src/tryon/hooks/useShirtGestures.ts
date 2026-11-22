import React, { useRef } from "react";

interface UseShirtGesturesProps {
  isActive: boolean;
  scale: number;
  rotate: number;
  setScale: (s: number) => void;
  onDragStart?: () => void;
  onDragMove?: (dx: number, dy: number) => void;
  onGestureEnd?: () => void;
}

export function useShirtGestures({
  isActive,
  scale,
  setScale,
  onDragStart,
  onDragMove,
  onGestureEnd,
}: UseShirtGesturesProps) {
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const lastSingle = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onDragStart?.();
    if (!isActive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) lastSingle.current = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 2) {
      const [p1, p2] = Array.from(pointers.current.values());
      pinchStart.current = { dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, scale };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isActive || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1 && lastSingle.current) {
      const dx = e.clientX - lastSingle.current.x;
      const dy = e.clientY - lastSingle.current.y;
      lastSingle.current = { x: e.clientX, y: e.clientY };
      onDragMove?.(dx, dy);
    } else if (pointers.current.size === 2 && pinchStart.current) {
      const [p1, p2] = Array.from(pointers.current.values());
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const next = Math.min(2.0, Math.max(0.5, pinchStart.current.scale * (dist / pinchStart.current.dist)));
      setScale(Number(next.toFixed(2)));
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
    lastSingle.current = pointers.current.size === 1 ? (pointers.current.values().next().value ?? null) : null;
    if (pointers.current.size < 2) pinchStart.current = null;
    onGestureEnd?.();
  };

  return { onPointerDown, onPointerMove, onPointerUp, pointersCount: pointers.current.size };
}
