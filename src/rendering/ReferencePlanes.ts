import * as THREE from 'three'

export interface ReferencePlaneOptions {
  range: number
}

interface PlaneDefinition {
  name: 'z=0' | 'x=0' | 'y=0'
  color: number
  opacity: number
  rotation: [number, number, number]
}

export class ReferencePlanes {
  private group: THREE.Group | null = null
  private readonly scene: THREE.Scene

  public constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  public update(options: ReferencePlaneOptions): void {
    const range = Math.max(1, options.range)
    const nextGroup = this.createGroup(range)
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

  private createGroup(range: number): THREE.Group {
    const group = new THREE.Group()
    const size = range * 2

    getPlaneDefinitions().forEach((definition) => {
      const geometry = new THREE.PlaneGeometry(size, size)
      const material = new THREE.MeshBasicMaterial({
        color: definition.color,
        transparent: true,
        opacity: definition.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const plane = new THREE.Mesh(geometry, material)

      plane.rotation.set(...definition.rotation)
      plane.position.set(0, 0, 0)
      plane.name = `reference-plane-${definition.name}`
      group.add(plane)
    })

    return group
  }
}

function getPlaneDefinitions(): PlaneDefinition[] {
  return [
    {
      name: 'z=0',
      color: 0x5db7ff,
      opacity: 0.12,
      rotation: [0, 0, 0],
    },
    {
      name: 'x=0',
      color: 0xff8aa0,
      opacity: 0.075,
      rotation: [0, Math.PI / 2, 0],
    },
    {
      name: 'y=0',
      color: 0x70e6a8,
      opacity: 0.075,
      rotation: [Math.PI / 2, 0, 0],
    },
  ]
}

function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    mesh.geometry?.dispose()

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]

    materials.forEach((material) => {
      material?.dispose()
    })
  })
}
