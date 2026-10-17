import { describe, expect, it } from 'vitest'
import {
  logicalCanvasSizeFromClient,
  logicalCanvasPointFromPointer,
  nodePositionFromPointer,
  resolveNodePosition,
} from '@/utils/workflowCanvas'

const bounds = {
  canvasWidth: 1120,
  canvasHeight: 620,
  nodeWidth: 172,
  nodeHeight: 76,
}

describe('workflow canvas pointer coordinates', () => {
  it('maps a pointer to logical canvas coordinates at zoom 1', () => {
    expect(logicalCanvasPointFromPointer({
      clientX: 180,
      clientY: 230,
      canvasLeft: 40,
      canvasTop: 30,
      scrollLeft: 20,
      scrollTop: 10,
      zoom: 1,
    })).toEqual({ x: 160, y: 210 })
  })

  it('corrects pointer coordinates for zoom and scroll', () => {
    expect(logicalCanvasPointFromPointer({
      clientX: 230,
      clientY: 155,
      canvasLeft: 30,
      canvasTop: 35,
      scrollLeft: 50,
      scrollTop: 30,
      zoom: 1.25,
    })).toEqual({ x: 200, y: 120 })
  })

  it('preserves the grab offset so pointer down has no jump', () => {
    const original = { x: 320, y: 180 }
    const grabOffset = { x: 48, y: 22 }
    const pointer = { x: original.x + grabOffset.x, y: original.y + grabOffset.y }

    expect(nodePositionFromPointer(pointer, grabOffset, bounds)).toEqual(original)
  })

  it('keeps arbitrary drop coordinates without snapping', () => {
    expect(nodePositionFromPointer(
      { x: 366.25, y: 199.75 },
      { x: 49, y: 31 },
      bounds,
    )).toEqual({ x: 317.25, y: 168.75 })
  })

  it('clamps only at logical canvas bounds', () => {
    expect(nodePositionFromPointer({ x: -10, y: -20 }, { x: 0, y: 0 }, bounds)).toEqual({ x: 0, y: 0 })
    expect(nodePositionFromPointer({ x: 2000, y: 2000 }, { x: 0, y: 0 }, bounds)).toEqual({
      x: 948,
      y: 544,
    })
  })

  it('derives logical drag bounds from the live canvas dimensions and zoom', () => {
    expect(logicalCanvasSizeFromClient({ clientWidth: 1200, clientHeight: 720, zoom: 1 })).toEqual({ x: 1200, y: 720 })
    expect(logicalCanvasSizeFromClient({ clientWidth: 900, clientHeight: 540, zoom: 1 })).toEqual({ x: 900, y: 540 })
    expect(logicalCanvasSizeFromClient({ clientWidth: 1200, clientHeight: 720, zoom: 1.2 })).toEqual({ x: 1000, y: 600 })
  })

  it('keeps the node footprint, labels, ports, and connector inside safe padding', () => {
    const safePadding = { top: 26, right: 72, bottom: 70, left: 28 }
    const dynamicBounds = { canvasWidth: 1000, canvasHeight: 600, nodeWidth: 164, nodeHeight: 164 }

    expect(nodePositionFromPointer({ x: 0, y: 0 }, { x: 0, y: 0 }, dynamicBounds, safePadding)).toEqual({ x: 28, y: 26 })
    expect(nodePositionFromPointer({ x: 2000, y: 2000 }, { x: 0, y: 0 }, dynamicBounds, safePadding)).toEqual({
      x: 764,
      y: 366,
    })
  })

  it('retains a manually positioned node through derived rerenders', () => {
    const manualPosition = { x: 411.5, y: 287.25 }

    expect(resolveNodePosition({ review: manualPosition }, 'review', { x: 570, y: 190 })).toBe(manualPosition)
    expect(resolveNodePosition({}, 'review', { x: 570, y: 190 })).toEqual({ x: 570, y: 190 })
  })
})
