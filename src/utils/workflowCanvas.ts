export type CanvasPoint = {
  x: number
  y: number
}

export type CanvasPointerInput = {
  clientX: number
  clientY: number
  canvasLeft: number
  canvasTop: number
  scrollLeft: number
  scrollTop: number
  zoom: number
}

export type CanvasNodeBounds = {
  canvasWidth: number
  canvasHeight: number
  nodeWidth: number
  nodeHeight: number
}

export type CanvasSafePadding = {
  top: number
  right: number
  bottom: number
  left: number
}

export type CanvasClientSize = {
  clientWidth: number
  clientHeight: number
  zoom: number
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

export function logicalCanvasSizeFromClient({ clientWidth, clientHeight, zoom }: CanvasClientSize): CanvasPoint {
  const safeZoom = zoom > 0 ? zoom : 1

  return {
    x: Math.max(0, clientWidth / safeZoom),
    y: Math.max(0, clientHeight / safeZoom),
  }
}

export const logicalCanvasPointFromPointer = ({
  clientX,
  clientY,
  canvasLeft,
  canvasTop,
  scrollLeft,
  scrollTop,
  zoom,
}: CanvasPointerInput): CanvasPoint => {
  const safeZoom = zoom > 0 ? zoom : 1

  return {
    x: (clientX - canvasLeft + scrollLeft) / safeZoom,
    y: (clientY - canvasTop + scrollTop) / safeZoom,
  }
}

export const nodePositionFromPointer = (
  pointer: CanvasPoint,
  grabOffset: CanvasPoint,
  { canvasWidth, canvasHeight, nodeWidth, nodeHeight }: CanvasNodeBounds,
  safePadding: CanvasSafePadding = { top: 0, right: 0, bottom: 0, left: 0 },
): CanvasPoint => ({
  x: clamp(
    pointer.x - grabOffset.x,
    safePadding.left,
    Math.max(safePadding.left, canvasWidth - nodeWidth - safePadding.right),
  ),
  y: clamp(
    pointer.y - grabOffset.y,
    safePadding.top,
    Math.max(safePadding.top, canvasHeight - nodeHeight - safePadding.bottom),
  ),
})

export const resolveNodePosition = <T extends CanvasPoint>(
  positions: Record<string, T>,
  nodeId: string,
  fallback: T,
) => positions[nodeId] ?? fallback
