import * as THREE from 'three'

export interface TextSpriteOptions {
  text: string
  fontSize?: number
  color?: string
  padding?: number
  scale?: number
}

export function createTextSprite(options: TextSpriteOptions): THREE.Sprite {
  const text = options.text
  const fontSize = options.fontSize ?? 42
  const padding = options.padding ?? 12
  const color = options.color ?? '#ffffff'
  const scale = options.scale ?? 0.48
  const canvas = createTextCanvas(text, fontSize, padding, color)
  const texture = new THREE.CanvasTexture(canvas)

  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(material)
  const aspect = canvas.width / canvas.height

  sprite.scale.set(scale * aspect, scale, 1)
  return sprite
}

function createTextCanvas(
  text: string,
  fontSize: number,
  padding: number,
  color: string,
): HTMLCanvasElement {
  const measureCanvas = document.createElement('canvas')
  const measureContext = measureCanvas.getContext('2d')
  if (!measureContext) {
    throw new Error('浏览器不支持 Canvas 2D，无法创建文字标签')
  }

  const font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  measureContext.font = font
  const metrics = measureContext.measureText(text)
  const width = Math.max(32, Math.ceil(metrics.width + padding * 2))
  const height = Math.max(32, Math.ceil(fontSize + padding * 2))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('浏览器不支持 Canvas 2D，无法创建文字标签')
  }

  canvas.width = width
  canvas.height = height
  context.clearRect(0, 0, width, height)
  context.font = font
  context.fillStyle = color
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, width / 2, height / 2)
  return canvas
}
