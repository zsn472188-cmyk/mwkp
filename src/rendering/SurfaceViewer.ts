import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  DEFAULT_EXPRESSION,
  DEFAULT_RANGE,
  DEFAULT_RESOLUTION,
  MAX_RANGE,
  MIN_RANGE,
} from '../constants'
import { createImplicitSurfaceGeometry } from '../geometry/MarchingCubesGeometry'
import { createSurfaceGeometry } from '../geometry/SurfaceGeometry'
import { classifyFormula } from '../math/FormulaClassifier'
import { compileExpression, compileImplicitExpression } from '../math/ExpressionParser'
import { AxisSystem } from './AxisSystem'
import { ReferencePlanes } from './ReferencePlanes'

export interface FormulaUpdateOptions {
  range: number
  resolution: number
}

export class SurfaceViewer {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true })
  private readonly controls: OrbitControls
  private readonly surfaceMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b9cff,
    roughness: 0.46,
    metalness: 0.08,
    side: THREE.DoubleSide,
  })
  private readonly axisSystem = new AxisSystem(this.scene)
  private readonly referencePlanes = new ReferencePlanes(this.scene)
  private readonly resizeObserver: ResizeObserver
  private surfaceMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  private animationFrameId: number | null = null
  private disposed = false
  private currentRange = DEFAULT_RANGE
  private readonly container: HTMLElement

  public constructor(container: HTMLElement) {
    this.container = container
    this.scene.background = new THREE.Color(0x0b1220)
    this.camera.up.set(0, 0, 1)
    this.camera.position.set(8, -10, 6)

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(
      Math.max(1, container.clientWidth),
      Math.max(1, container.clientHeight),
      false,
    )
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enableZoom = true
    this.controls.minDistance = 2
    this.controls.maxDistance = 100
    this.controls.target.set(0, 0, 0)

    this.addLights()

    const geometry = createSurfaceGeometry(
      compileExpression(DEFAULT_EXPRESSION),
      DEFAULT_RANGE,
    )
    this.surfaceMesh = new THREE.Mesh(geometry, this.surfaceMaterial)
    this.scene.add(this.surfaceMesh)
    this.updateCoordinateReference(DEFAULT_RANGE)
    this.resetCamera()

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    window.addEventListener('beforeunload', this.dispose)
    this.resize()
    this.start()
  }

  public updateFormula(input: string, options: FormulaUpdateOptions): void {
    const range = normalizeRange(options.range)
    const resolution = normalizeResolution(options.resolution)
    const classified = classifyFormula(input)

    let newGeometry: THREE.BufferGeometry

    if (classified.mode === 'explicit') {
      const evaluator = compileExpression(classified.normalizedExpression)
      newGeometry = createSurfaceGeometry(evaluator, range)
    } else {
      const evaluator = compileImplicitExpression(classified.normalizedExpression)
      newGeometry = createImplicitSurfaceGeometry(evaluator, {
        xMin: -range,
        xMax: range,
        yMin: -range,
        yMax: range,
        zMin: -range,
        zMax: range,
        resolution,
      })
    }

    const oldGeometry = this.surfaceMesh.geometry
    this.surfaceMesh.geometry = newGeometry
    oldGeometry.dispose()
    this.currentRange = range
    this.updateCoordinateReference(range)
  }

  public resetCamera(): void {
    const distance = Math.max(8, this.currentRange * 2.2)
    this.camera.position.set(distance * 0.72, -distance * 0.92, distance * 0.55)
    this.controls.target.set(0, 0, 0)
    this.camera.lookAt(this.controls.target)
    this.controls.update()
  }

  public dispose = (): void => {
    if (this.disposed) return
    this.disposed = true

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    window.removeEventListener('beforeunload', this.dispose)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.axisSystem.dispose()
    this.referencePlanes.dispose()
    this.surfaceMesh.geometry.dispose()
    this.surfaceMaterial.dispose()
    this.scene.remove(this.surfaceMesh)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x152238, 1.25))

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.55)
    keyLight.position.set(7, -10, 14)
    this.scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x7aa7ff, 0.45)
    fillLight.position.set(-10, 6, 5)
    this.scene.add(fillLight)
  }

  private updateCoordinateReference(range: number): void {
    this.referencePlanes.update({ range })
    this.axisSystem.update({
      range,
      tickStep: 1,
      labelStep: range > 10 ? 5 : 2,
    })
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  private start(): void {
    if (this.animationFrameId !== null) return
    this.render()
  }

  private render = (): void => {
    if (this.disposed) return

    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.animationFrameId = requestAnimationFrame(this.render)
  }
}

function normalizeRange(range: number): number {
  if (!Number.isFinite(range)) return DEFAULT_RANGE
  return Math.min(MAX_RANGE, Math.max(MIN_RANGE, range))
}

function normalizeResolution(resolution: number): number {
  if (!Number.isFinite(resolution)) return DEFAULT_RESOLUTION
  return Math.min(40, Math.max(12, Math.floor(resolution)))
}
