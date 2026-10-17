import { describe, expect, it } from 'vitest'
import type { WorkflowNode } from '@/types/workflow'
import { workflowEdgePath } from '@/utils/workflowEdges'
import {
  WORKFLOW_ARROW_SIZE,
  WORKFLOW_EDGE_STROKE_WIDTH,
  WORKFLOW_NODE_LABEL_MAX_WIDTH,
  WORKFLOW_NODE_SIZE,
  WORKFLOW_PORT_DIAMETER,
} from '@/utils/workflowGraphGeometry'

const nodeWidth = 164
const nodeHeight = 164

const nodes: WorkflowNode[] = [
  { id: 'todo', name: 'برای انجام', color: '#64748b', x: 120, y: 220 },
  { id: 'progress', name: 'در حال انجام', color: '#3b82f6', x: 440, y: 80 },
  { id: 'review', name: 'بازبینی', color: '#f59e0b', x: 760, y: 260 },
]

const edge = (from: string, to: string, positionedNodes = nodes) => workflowEdgePath({
  transition: { id: `${from}-${to}`, from, to },
  nodes: positionedNodes,
  nodeWidth,
  nodeHeight,
  portOffset: 14,
})

describe('workflow edge routing', () => {
  it('recalculates a connected edge from the same live node position used by drag', () => {
    const before = edge('todo', 'progress')
    const movedNodes = nodes.map((node) => node.id === 'todo' ? { ...node, x: 250, y: 310 } : node)
    const after = edge('todo', 'progress', movedNodes)

    expect(before?.path).not.toEqual(after?.path)
    expect(after?.path).toContain('428 392')
  })

  it('routes reverse transitions on a distinct curve instead of overlapping the forward edge', () => {
    const forward = edge('todo', 'progress')
    const reverse = edge('progress', 'todo')

    expect(forward?.path).not.toEqual(reverse?.path)
    expect(reverse?.label.y).toBeGreaterThan(Math.max(nodes[0].y + nodeHeight, nodes[1].y + nodeHeight))
  })

  it('diverts an edge around an intervening node rather than through its body', () => {
    const routedNodes: WorkflowNode[] = [
      { ...nodes[0], x: 80, y: 200 },
      { ...nodes[1], x: 360, y: 180 },
      { ...nodes[2], x: 700, y: 200 },
    ]
    const routed = edge('todo', 'review', routedNodes)

    expect(routed?.label.y).toBeGreaterThan(routedNodes[1].y + nodeHeight)
  })

  it('keeps a nearby small-node transition on a compact simple Bézier', () => {
    const compactNodes: WorkflowNode[] = [
      { id: 'a', name: 'A', color: '#000', x: 100, y: 100 },
      { id: 'b', name: 'B', color: '#000', x: 180, y: 110 },
    ]
    const routed = workflowEdgePath({
      transition: { id: 'a-b', from: 'a', to: 'b' },
      nodes: compactNodes,
      nodeWidth: WORKFLOW_NODE_SIZE,
      nodeHeight: WORKFLOW_NODE_SIZE,
      portOffset: WORKFLOW_PORT_DIAMETER / 2,
    })

    expect(routed?.path).toMatch(/^M 159 127 C 165\.08 127, 168\.92 137, 175 137$/)
    expect(routed?.label.y).toBeLessThan(127)
  })

  it('keeps reverse small-node transitions in a distinct compact lane', () => {
    const compactNodes: WorkflowNode[] = [
      { id: 'a', name: 'A', color: '#000', x: 100, y: 100 },
      { id: 'b', name: 'B', color: '#000', x: 180, y: 110 },
    ]
    const forward = workflowEdgePath({ transition: { id: 'a-b', from: 'a', to: 'b' }, nodes: compactNodes, nodeWidth: 54, nodeHeight: 54, portOffset: 5 })
    const reverse = workflowEdgePath({ transition: { id: 'b-a', from: 'b', to: 'a' }, nodes: compactNodes, nodeWidth: 54, nodeHeight: 54, portOffset: 5 })

    expect(reverse?.path).not.toEqual(forward?.path)
    expect(reverse?.label.y).toBeGreaterThan(164)
    expect(reverse?.label.y).toBeLessThan(230)
  })

  it('takes a compact detour below only the blocking small node', () => {
    const compactNodes: WorkflowNode[] = [
      { id: 'a', name: 'A', color: '#000', x: 50, y: 100 },
      { id: 'blocker', name: 'Blocker', color: '#000', x: 150, y: 100 },
      { id: 'b', name: 'B', color: '#000', x: 250, y: 100 },
    ]
    const routed = workflowEdgePath({ transition: { id: 'a-b', from: 'a', to: 'b' }, nodes: compactNodes, nodeWidth: 54, nodeHeight: 54, portOffset: 5 })

    expect(routed?.label.y).toBeGreaterThan(154)
    expect(routed?.label.y).toBeLessThan(208)
  })

  it('starts and ends exactly at the outer edges of the small ports', () => {
    const compactNodes: WorkflowNode[] = [
      { id: 'a', name: 'A', color: '#000', x: 100, y: 100 },
      { id: 'b', name: 'B', color: '#000', x: 180, y: 110 },
    ]
    const routed = workflowEdgePath({ transition: { id: 'a-b', from: 'a', to: 'b' }, nodes: compactNodes, nodeWidth: 54, nodeHeight: 54, portOffset: 5 })

    expect(routed?.path).toMatch(/^M 159 127/)
    expect(routed?.path).toMatch(/175 137$/)
  })

  it('keeps labels and edge parts proportional to the 54px node geometry', () => {
    expect(WORKFLOW_NODE_LABEL_MAX_WIDTH).toBeGreaterThan(WORKFLOW_NODE_SIZE)
    expect(WORKFLOW_ARROW_SIZE).toBeLessThan(WORKFLOW_PORT_DIAMETER)
    expect(WORKFLOW_EDGE_STROKE_WIDTH).toBeLessThan(WORKFLOW_PORT_DIAMETER / 2)
  })
})
