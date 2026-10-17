import type { WorkflowNode, WorkflowTransition } from '@/types/workflow'

type EdgePathInput = {
  transition: WorkflowTransition
  nodes: WorkflowNode[]
  nodeWidth: number
  nodeHeight: number
  portOffset: number
  routeOffset?: number
}

export type WorkflowEdgePath = {
  path: string
  label: { x: number; y: number }
}

const nodeObstacles = (
  nodes: WorkflowNode[],
  fromId: string,
  toId: string,
  left: number,
  right: number,
  top: number,
  bottom: number,
  nodeWidth: number,
  nodeHeight: number,
) => nodes.filter((node) => node.id !== fromId
  && node.id !== toId
  && node.x < right
  && node.x + nodeWidth > left
  && node.y < bottom
  && node.y + nodeHeight > top)

export function workflowEdgePath({
  transition,
  nodes,
  nodeWidth,
  nodeHeight,
  portOffset,
  routeOffset = 0,
}: EdgePathInput): WorkflowEdgePath | null {
  const from = nodes.find((node) => node.id === transition.from)
  const to = nodes.find((node) => node.id === transition.to)
  if (!from || !to) return null

  const start = { x: from.x + nodeWidth + portOffset, y: from.y + nodeHeight / 2 }
  const end = { x: to.x - portOffset, y: to.y + nodeHeight / 2 }
  const directLeft = Math.min(start.x, end.x)
  const directRight = Math.max(start.x, end.x)
  const directTop = Math.min(start.y, end.y)
  const directBottom = Math.max(start.y, end.y)
  const reversesDirection = start.x > end.x
  const obstacles = nodeObstacles(
    nodes,
    transition.from,
    transition.to,
    directLeft,
    directRight,
    directTop - nodeHeight / 2,
    directBottom + nodeHeight / 2,
    nodeWidth,
    nodeHeight,
  )

  const horizontalDistance = Math.abs(end.x - start.x)
  const labelOffset = Math.max(8, nodeHeight * 0.15)

  if (!reversesDirection && obstacles.length === 0) {
    const curve = Math.min(horizontalDistance * 0.38, nodeWidth * 1.1) + routeOffset
    return {
      path: `M ${start.x} ${start.y} C ${start.x + curve} ${start.y}, ${end.x - curve} ${end.y}, ${end.x} ${end.y}`,
      label: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - labelOffset },
    }
  }

  const furthestObstacleBottom = obstacles.reduce((bottom, node) => Math.max(bottom, node.y + nodeHeight), -Infinity)
  const routeClearance = Math.max(nodeHeight * 0.55, portOffset * 5)
  const laneY = Math.max(from.y + nodeHeight, to.y + nodeHeight, furthestObstacleBottom) + routeClearance + routeOffset
  const exit = Math.max(nodeWidth * 0.65, portOffset * 4)
  const middleX = (start.x + end.x) / 2
  return {
    path: `M ${start.x} ${start.y} C ${start.x + exit} ${start.y}, ${start.x + exit} ${laneY}, ${middleX} ${laneY} C ${end.x - exit} ${laneY}, ${end.x - exit} ${end.y}, ${end.x} ${end.y}`,
    label: { x: middleX, y: laneY - labelOffset },
  }
}
