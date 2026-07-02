import * as THREE from 'three'
import { getMarchingCubesTables } from './MarchingCubesTables'

type ImplicitEvaluator = (x: number, y: number, z: number) => number

export interface ImplicitSurfaceOptions {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  zMin: number
  zMax: number
  resolution: number
  isoLevel?: number
}

interface NormalizedImplicitSurfaceOptions extends ImplicitSurfaceOptions {
  isoLevel: number
}

const MIN_RESOLUTION = 12
const MAX_RESOLUTION = 40
const DEFAULT_ISO_LEVEL = 0
const MAX_ABS_FIELD_VALUE = 1e6
const INVALID_FIELD_VALUE = 1e6
const MAX_TRIANGLES = 260000
const INTERPOLATION_EPSILON = 1e-8

const CUBE_CORNERS: number[][] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
]

const CUBE_EDGES: number[][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
]

export function createImplicitSurfaceGeometry(
  evaluator: ImplicitEvaluator,
  options: ImplicitSurfaceOptions,
): THREE.BufferGeometry {
  const { edgeTable, triTable } = getMarchingCubesTables()
  const normalizedOptions = normalizeOptions(options)
  const { resolution, isoLevel } = normalizedOptions
  const sampleSide = resolution + 1
  const sampleCount = sampleSide * sampleSide * sampleSide
  const field = new Float32Array(sampleCount)
  const validSamples = new Uint8Array(sampleCount)
  const positions: number[] = []
  const xValues = buildAxisValues(normalizedOptions.xMin, normalizedOptions.xMax, resolution)
  const yValues = buildAxisValues(normalizedOptions.yMin, normalizedOptions.yMax, resolution)
  const zValues = buildAxisValues(normalizedOptions.zMin, normalizedOptions.zMax, resolution)

  let hasValidSample = false
  let hasBelow = false
  let hasAbove = false

  for (let k = 0; k <= resolution; k += 1) {
    for (let j = 0; j <= resolution; j += 1) {
      for (let i = 0; i <= resolution; i += 1) {
        const sampleIndex = index3(i, j, k, sampleSide)
        const value = safeEvaluate(evaluator, xValues[i], yValues[j], zValues[k])

        if (isValidFieldValue(value)) {
          field[sampleIndex] = value
          validSamples[sampleIndex] = 1
          hasValidSample = true
          if (value < isoLevel) hasBelow = true
          if (value > isoLevel) hasAbove = true
        } else {
          field[sampleIndex] = INVALID_FIELD_VALUE
          validSamples[sampleIndex] = 0
        }
      }
    }
  }

  if (!hasValidSample) {
    throw new Error('函数在当前范围内没有有效采样值，请检查表达式')
  }

  if (!hasBelow || !hasAbove) {
    throw new Error('当前范围内没有找到该函数图像，请调整范围 R')
  }

  const cornerValues = new Array<number>(8)
  const cornerValid = new Array<boolean>(8)
  const cornerPoints = new Array<number>(8 * 3)
  const edgePoints = new Array<number>(12 * 3)

  for (let k = 0; k < resolution; k += 1) {
    for (let j = 0; j < resolution; j += 1) {
      for (let i = 0; i < resolution; i += 1) {
        let cubeIndex = 0
        let allCornersValid = true

        for (let corner = 0; corner < 8; corner += 1) {
          const cornerOffset = CUBE_CORNERS[corner]
          const sampleI = i + cornerOffset[0]
          const sampleJ = j + cornerOffset[1]
          const sampleK = k + cornerOffset[2]
          const sampleIndex = index3(sampleI, sampleJ, sampleK, sampleSide)
          const value = field[sampleIndex]
          const isValid = validSamples[sampleIndex] === 1
          const pointOffset = corner * 3

          cornerValues[corner] = value
          cornerValid[corner] = isValid
          cornerPoints[pointOffset] = xValues[sampleI]
          cornerPoints[pointOffset + 1] = yValues[sampleJ]
          cornerPoints[pointOffset + 2] = zValues[sampleK]

          if (!isValid) {
            allCornersValid = false
          } else if (value < isoLevel) {
            cubeIndex |= 1 << corner
          }
        }

        if (!allCornersValid || cubeIndex === 0 || cubeIndex === 255) {
          continue
        }

        const edgeMask = edgeTable[cubeIndex]
        if (edgeMask === 0) {
          continue
        }

        for (let edge = 0; edge < 12; edge += 1) {
          if ((edgeMask & (1 << edge)) === 0) {
            continue
          }

          const [a, b] = CUBE_EDGES[edge]

          if (!cornerValid[a] || !cornerValid[b]) {
            continue
          }

          writeInterpolatedPoint(
            edgePoints,
            edge * 3,
            cornerPoints,
            a * 3,
            b * 3,
            cornerValues[a],
            cornerValues[b],
            isoLevel,
          )
        }

        const tableOffset = cubeIndex * 16
        for (let tableIndex = 0; tableIndex < 16; tableIndex += 3) {
          const edgeA = triTable[tableOffset + tableIndex]
          if (edgeA === -1) break

          const edgeB = triTable[tableOffset + tableIndex + 1]
          const edgeC = triTable[tableOffset + tableIndex + 2]
          pushTriangle(positions, edgePoints, edgeA, edgeB, edgeC)

          if (positions.length / 9 > MAX_TRIANGLES) {
            throw new Error('三角形数量超过安全限制，请降低精度')
          }
        }
      }
    }
  }

  if (positions.length === 0) {
    throw new Error('没有生成任何三角形，请检查函数或范围 R')
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Float32Array(positions), 3),
  )
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function normalizeOptions(options: ImplicitSurfaceOptions): NormalizedImplicitSurfaceOptions {
  const resolution = Math.floor(options.resolution)

  if (resolution < MIN_RESOLUTION || resolution > MAX_RESOLUTION) {
    throw new Error(`精度必须在 ${MIN_RESOLUTION} 到 ${MAX_RESOLUTION} 之间`)
  }

  validateRange('x', options.xMin, options.xMax)
  validateRange('y', options.yMin, options.yMax)
  validateRange('z', options.zMin, options.zMax)

  return {
    ...options,
    resolution,
    isoLevel: options.isoLevel ?? DEFAULT_ISO_LEVEL,
  }
}

function validateRange(axis: string, min: number, max: number): void {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(`${axis} 坐标范围必须是有效数字`)
  }

  if (min >= max) {
    throw new Error(`${axis} 坐标范围最小值必须小于最大值`)
  }
}

function buildAxisValues(min: number, max: number, resolution: number): Float32Array {
  const values = new Float32Array(resolution + 1)
  const step = (max - min) / resolution

  for (let index = 0; index <= resolution; index += 1) {
    values[index] = min + step * index
  }

  return values
}

function index3(i: number, j: number, k: number, side: number): number {
  return i + side * (j + side * k)
}

function safeEvaluate(
  evaluator: ImplicitEvaluator,
  x: number,
  y: number,
  z: number,
): number {
  try {
    return evaluator(x, y, z)
  } catch {
    return INVALID_FIELD_VALUE
  }
}

function isValidFieldValue(value: number): boolean {
  return !Number.isNaN(value) && Number.isFinite(value) && Math.abs(value) <= MAX_ABS_FIELD_VALUE
}

function writeInterpolatedPoint(
  edgePoints: number[],
  edgeOffset: number,
  cornerPoints: number[],
  pointAOffset: number,
  pointBOffset: number,
  valueA: number,
  valueB: number,
  isoLevel: number,
): void {
  const delta = valueB - valueA
  let t = 0.5

  if (Math.abs(delta) > INTERPOLATION_EPSILON) {
    t = clamp((isoLevel - valueA) / delta, 0, 1)
  }

  edgePoints[edgeOffset] = lerp(cornerPoints[pointAOffset], cornerPoints[pointBOffset], t)
  edgePoints[edgeOffset + 1] = lerp(cornerPoints[pointAOffset + 1], cornerPoints[pointBOffset + 1], t)
  edgePoints[edgeOffset + 2] = lerp(cornerPoints[pointAOffset + 2], cornerPoints[pointBOffset + 2], t)
}

function pushTriangle(
  positions: number[],
  edgePoints: number[],
  edgeA: number,
  edgeB: number,
  edgeC: number,
): void {
  pushEdgePoint(positions, edgePoints, edgeA)
  pushEdgePoint(positions, edgePoints, edgeB)
  pushEdgePoint(positions, edgePoints, edgeC)
}

function pushEdgePoint(positions: number[], edgePoints: number[], edge: number): void {
  const offset = edge * 3
  positions.push(edgePoints[offset], edgePoints[offset + 1], edgePoints[offset + 2])
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
