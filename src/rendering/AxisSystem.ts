import * as THREE from 'three'
import { createTextSprite } from './TextSprite'

export interface AxisOptions {
  range: number
  tickStep: number
  labelStep: number
}

interface AxisDefinition {
  name: 'x' | 'y' | 'z'
  color: number
  cssColor: string
  start: THREE.Vector3
  end: THREE.Vector3
  labelPosition: THREE.Vector3
}

export class AxisSystem {
  private group: THREE.Group | null = null
  private readonly scene: THREE.Scene

  public constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  public update(options: AxisOptions): void {
    const normalized = normalizeAxisOptions(options)
    const nextGroup = this.createGroup(normalized)
    const oldGroup = this.group

    this.group = nextGroup
    this.scene.add(nextGroup)

    if (oldGroup) {
      this.scene.remove(oldGroup)
      disposeObjectTree(oldGroup)
    }
  }

  public dispose(): void {
    if (!this.group) return
    this.scene.remove(this.group)
    disposeObjectTree(this.group)
    this.group = null
  }

  private createGroup(options: AxisOptions): THREE.Group {
    const group = new THREE.Group()
    const range = options.range
    const tickSize = Math.max(0.08, range * 0.025)
    const labelOffset = Math.max(0.42, range * 0.075)
    const axes = createAxisDefinitions(range)

    axes.forEach((axis) => {
      group.add(this.createLine(axis.start, axis.end, axis.color))
      group.add(this.createPositiveArrow(axis, range))
      this.addAxisTicks(group, axis, options, tickSize, labelOffset)
      this.addLabel(group, axis.name, axis.labelPosition, axis.cssColor, 0.72)
    })

    return group
  }

  private addAxisTicks(
    group: THREE.Group,
    axis: AxisDefinition,
    options: AxisOptions,
    tickSize: number,
    labelOffset: number,
  ): void {
    const range = options.range
    const tickCount = Math.floor(range / options.tickStep)

    for (let tick = -tickCount; tick <= tickCount; tick += 1) {
      const value = roundTick(tick * options.tickStep)

      if (Math.abs(value) > range + 1e-6) continue

      if (Math.abs(value) > 1e-6) {
        group.add(this.createLine(
          getTickStart(axis.name, value, tickSize),
          getTickEnd(axis.name, value, tickSize),
          axis.color,
        ))
      }

      if (shouldShowNumberLabel(value, options.labelStep, axis.name)) {
        group.add(this.createNumberLabel(axis, value, labelOffset))
      }
    }
  }

  private createNumberLabel(
    axis: AxisDefinition,
    value: number,
    labelOffset: number,
  ): THREE.Sprite {
    const position = getNumberLabelPosition(axis.name, value, labelOffset)
    const label = Math.abs(value) < 1e-6 ? '0' : formatTickLabel(value)
    return this.createPlacedText(label, position, axis.cssColor, 0.42)
  }

  private addLabel(
    group: THREE.Group,
    text: string,
    position: THREE.Vector3,
    color: string,
    scale: number,
  ): void {
    group.add(this.createPlacedText(text, position, color, scale))
  }

  private createPlacedText(
    text: string,
    position: THREE.Vector3,
    color: string,
    scale: number,
  ): THREE.Sprite {
    const sprite = createTextSprite({
      text,
      color,
      fontSize: text.length === 1 ? 54 : 42,
      scale,
    })
    sprite.position.copy(position)
    return sprite
  }

  private createLine(start: THREE.Vector3, end: THREE.Vector3, color: number): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end])
    const material = new THREE.LineBasicMaterial({ color })
    return new THREE.Line(geometry, material)
  }

  private createPositiveArrow(axis: AxisDefinition, range: number): THREE.Group {
    const arrowLength = Math.max(0.45, Math.min(1.25, range * 0.16))
    const headLength = arrowLength * 0.52
    const headWidth = Math.max(0.14, headLength * 0.46)
    const origin = getArrowOrigin(axis.name, range - arrowLength)
    const end = getArrowEnd(axis.name, range)
    const group = new THREE.Group()

    group.add(this.createLine(origin, end, axis.color))

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(headWidth, headLength, 24),
      new THREE.MeshBasicMaterial({ color: axis.color }),
    )
    placeCone(cone, axis.name, range, headLength)
    group.add(cone)
    return group
  }
}

function normalizeAxisOptions(options: AxisOptions): AxisOptions {
  const range = Math.max(1, Math.ceil(options.range))
  return {
    range,
    tickStep: options.tickStep > 0 ? options.tickStep : 1,
    labelStep: options.labelStep > 0 ? options.labelStep : 2,
  }
}

function createAxisDefinitions(range: number): AxisDefinition[] {
  const labelDistance = range + Math.max(0.75, range * 0.14)

  return [
    {
      name: 'x',
      color: 0xff5c5c,
      cssColor: '#ff7777',
      start: new THREE.Vector3(-range, 0, 0),
      end: new THREE.Vector3(range, 0, 0),
      labelPosition: new THREE.Vector3(labelDistance, 0, 0),
    },
    {
      name: 'y',
      color: 0x5de08a,
      cssColor: '#73ee9b',
      start: new THREE.Vector3(0, -range, 0),
      end: new THREE.Vector3(0, range, 0),
      labelPosition: new THREE.Vector3(0, labelDistance, 0),
    },
    {
      name: 'z',
      color: 0x5aa8ff,
      cssColor: '#75b8ff',
      start: new THREE.Vector3(0, 0, -range),
      end: new THREE.Vector3(0, 0, range),
      labelPosition: new THREE.Vector3(0, 0, labelDistance),
    },
  ]
}

function getArrowOrigin(axis: 'x' | 'y' | 'z', value: number): THREE.Vector3 {
  if (axis === 'x') return new THREE.Vector3(value, 0, 0)
  if (axis === 'y') return new THREE.Vector3(0, value, 0)
  return new THREE.Vector3(0, 0, value)
}

function getArrowEnd(axis: 'x' | 'y' | 'z', value: number): THREE.Vector3 {
  if (axis === 'x') return new THREE.Vector3(value, 0, 0)
  if (axis === 'y') return new THREE.Vector3(0, value, 0)
  return new THREE.Vector3(0, 0, value)
}

function placeCone(
  cone: THREE.Mesh,
  axis: 'x' | 'y' | 'z',
  range: number,
  headLength: number,
): void {
  const center = range - headLength / 2

  if (axis === 'x') {
    cone.position.set(center, 0, 0)
    cone.rotation.z = -Math.PI / 2
    return
  }

  if (axis === 'y') {
    cone.position.set(0, center, 0)
    return
  }

  cone.position.set(0, 0, center)
  cone.rotation.x = Math.PI / 2
}

function getTickStart(axis: 'x' | 'y' | 'z', value: number, size: number): THREE.Vector3 {
  if (axis === 'x') return new THREE.Vector3(value, -size, 0)
  if (axis === 'y') return new THREE.Vector3(-size, value, 0)
  return new THREE.Vector3(-size, 0, value)
}

function getTickEnd(axis: 'x' | 'y' | 'z', value: number, size: number): THREE.Vector3 {
  if (axis === 'x') return new THREE.Vector3(value, size, 0)
  if (axis === 'y') return new THREE.Vector3(size, value, 0)
  return new THREE.Vector3(size, 0, value)
}

function getNumberLabelPosition(
  axis: 'x' | 'y' | 'z',
  value: number,
  offset: number,
): THREE.Vector3 {
  if (axis === 'x') return new THREE.Vector3(value, -offset, 0)
  if (axis === 'y') return new THREE.Vector3(-offset, value, 0)
  return new THREE.Vector3(offset, 0, value)
}

function shouldShowNumberLabel(
  value: number,
  labelStep: number,
  axis: 'x' | 'y' | 'z',
): boolean {
  if (Math.abs(value) < 1e-6) {
    return axis === 'x'
  }

  const ratio = value / labelStep
  return Math.abs(ratio - Math.round(ratio)) < 1e-6
}

function roundTick(value: number): number {
  return Math.round(value * 1000000) / 1000000
}

function formatTickLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    mesh.geometry?.dispose()

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]

    materials.forEach((material) => {
      if (material && 'map' in material) {
        const maybeMapped = material as THREE.Material & { map?: THREE.Texture }
        maybeMapped.map?.dispose()
      }
      material?.dispose()
    })
  })
}
