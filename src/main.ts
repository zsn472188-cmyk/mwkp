import './style.css'
import {
  DEFAULT_EXPRESSION,
  DEFAULT_RANGE,
  DEFAULT_RESOLUTION,
  HIGH_RESOLUTION,
  LOW_RESOLUTION,
  MAX_RANGE,
  MEDIUM_RESOLUTION,
  MIN_RANGE,
} from './constants'
import { SurfaceViewer } from './rendering/SurfaceViewer'

const viewerHost = getRequiredElement<HTMLDivElement>('viewer')
const expressionInput = getRequiredElement<HTMLInputElement>('formula-input')
const rangeInput = getRequiredElement<HTMLInputElement>('range-input')
const resolutionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-resolution]'))
const generateButton = getRequiredElement<HTMLButtonElement>('generate-button')
const resetFormulaButton = getRequiredElement<HTMLButtonElement>('reset-formula-button')
const resetViewButton = getRequiredElement<HTMLButtonElement>('reset-view-button')
const errorMessage = getRequiredElement<HTMLDivElement>('error-message')

let currentResolution = DEFAULT_RESOLUTION
let viewer: SurfaceViewer

expressionInput.value = DEFAULT_EXPRESSION
rangeInput.value = String(DEFAULT_RANGE)
setResolution(DEFAULT_RESOLUTION)

try {
  viewer = new SurfaceViewer(viewerHost)
} catch (error) {
  showError(getErrorMessage(error) || '初始化三维视图失败')
  throw error
}

generateButton.addEventListener('click', () => {
  const expression = expressionInput.value.trim()

  try {
    const range = normalizeRangeInput(rangeInput.value)
    rangeInput.value = String(range)
    viewer.updateFormula(expression, {
      range,
      resolution: currentResolution,
    })
    showError('')
  } catch (error) {
    showError(getErrorMessage(error) || '生成图像失败，请检查函数')
  }
})

resetFormulaButton.addEventListener('click', () => {
  expressionInput.value = DEFAULT_EXPRESSION
  rangeInput.value = String(DEFAULT_RANGE)
  setResolution(MEDIUM_RESOLUTION)

  try {
    viewer.updateFormula(DEFAULT_EXPRESSION, {
      range: DEFAULT_RANGE,
      resolution: DEFAULT_RESOLUTION,
    })
    viewer.resetCamera()
    showError('')
  } catch (error) {
    showError(getErrorMessage(error) || '恢复默认失败')
  }
})

resetViewButton.addEventListener('click', () => {
  viewer.resetCamera()
})

resolutionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const resolution = Number(button.dataset.resolution)
    setResolution(resolution)
  })
})

rangeInput.addEventListener('change', () => {
  try {
    rangeInput.value = String(normalizeRangeInput(rangeInput.value))
    showError('')
  } catch (error) {
    rangeInput.value = String(DEFAULT_RANGE)
    showError(getErrorMessage(error))
  }
})

function setResolution(resolution: number): void {
  const allowed = [LOW_RESOLUTION, MEDIUM_RESOLUTION, HIGH_RESOLUTION]
  currentResolution = allowed.includes(resolution) ? resolution : MEDIUM_RESOLUTION

  resolutionButtons.forEach((button) => {
    const isActive = Number(button.dataset.resolution) === currentResolution
    button.classList.toggle('active', isActive)
    button.setAttribute('aria-pressed', String(isActive))
  })
}

function normalizeRangeInput(value: string): number {
  const normalizedValue = value.trim()
  if (!normalizedValue) {
    throw new Error(`范围 R 必须是 ${MIN_RANGE} 到 ${MAX_RANGE} 之间的数字`)
  }

  const range = Number(normalizedValue)
  if (!Number.isFinite(range)) {
    throw new Error(`范围 R 必须是 ${MIN_RANGE} 到 ${MAX_RANGE} 之间的数字`)
  }

  return Math.min(MAX_RANGE, Math.max(MIN_RANGE, range))
}

function showError(message: string): void {
  errorMessage.textContent = message
  errorMessage.hidden = !message
}

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) {
    throw new Error(`页面缺少元素：#${id}`)
  }
  return element as T
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
