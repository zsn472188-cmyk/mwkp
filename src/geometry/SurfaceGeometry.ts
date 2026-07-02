import * as THREE from 'three'
import {
  DEFAULT_RANGE,
  MAX_RANGE,
  MIN_RANGE,
  SURFACE_SEGMENTS,
} from '../constants'

const MAX_ABS_Z = 50

export type SurfaceEvaluator = (x: number, y: number) => number

export function createSurfaceGeometry(
  evaluator: SurfaceEvaluator,
  range = DEFAULT_RANGE,
): THREE.BufferGeometry {
  const surfaceRange = normalizeRange(range)
  const vertexCountPerSide = SURFACE_SEGMENTS + 1
  const vertexCount = vertexCountPerSide * vertexCountPerSide
  const positions = new Float32Array(vertexCount * 3)
  const validVertices = new Array<boolean>(vertexCount)
  const indices: number[] = []
  const step = (surfaceRange * 2) / SURFACE_SEGMENTS

  let vertexOffset = 0
  let vertexIndex = 0

  for (let row = 0; row <= SURFACE_SEGMENTS; row += 1) {
    const y = -surfaceRange + row * step

    for (let column = 0; column <= SURFACE_SEGMENTS; column += 1) {
      const x = -surfaceRange + column * step
      const z = evaluator(x, y)
      const isValid = isValidHeight(z)

      positions[vertexOffset] = x
      positions[vertexOffset + 1] = y
      positions[vertexOffset + 2] = isValid ? z : 0
      validVertices[vertexIndex] = isValid

      vertexOffset += 3
      vertexIndex += 1
    }
  }

  for (let row = 0; row < SURFACE_SEGMENTS; row += 1) {
    for (let column = 0; column < SURFACE_SEGMENTS; column += 1) {
      const topLeft = row * vertexCountPerSide + column
      const topRight = topLeft + 1
      const bottomLeft = topLeft + vertexCountPerSide
      const bottomRight = bottomLeft + 1

      pushTriangleIfValid(indices, validVertices, topLeft, topRight, bottomLeft)
      pushTriangleIfValid(indices, validVertices, topRight, bottomRight, bottomLeft)
    }
  }

  if (indices.length === 0) {
    throw new Error('表达式在当前范围内没有可显示的有效曲面')
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function normalizeRange(range: number): number {
  if (!Number.isFinite(range)) {
    return DEFAULT_RANGE
  }

  return Math.min(MAX_RANGE, Math.max(MIN_RANGE, range))
}

function isValidHeight(z: number): boolean {
  return !Number.isNaN(z) && Number.isFinite(z) && Math.abs(z) <= MAX_ABS_Z
}

function pushTriangleIfValid(
  indices: number[],
  validVertices: boolean[],
  a: number,
  b: number,
  c: number,
): void {
  if (!validVertices[a] || !validVertices[b] || !validVertices[c]) {
    return
  }

  indices.push(a, b, c)
}
