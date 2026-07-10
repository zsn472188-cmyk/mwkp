import 'mathlive/static.css'
import 'mathlive'
import './style.css'
import type { MathfieldElement } from 'mathlive'
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
import { latexToRaw } from './input/LatexToRaw'
import { SurfaceViewer } from './rendering/SurfaceViewer'

const DEFAULT_LATEX = String.raw`\sin\left(\sqrt{x^2+y^2}\right)`

const viewerHost = getRequiredElement<HTMLDivElement>('viewer')
const formulaField = getRequiredElement<MathfieldElement>('formula-field')
const rangeInput = getRequiredElement<HTMLInputElement>('range-input')
const resolutionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-resolution]'))
const generateButton = getRequiredElement<HTMLButtonElement>('generate-button')
const resetFormulaButton = getRequiredElement<HTMLButtonElement>('reset-formula-button')
const resetViewButton = getRequiredElement<HTMLButtonElement>('reset-view-button')
const errorMessage = getRequiredElement<HTMLDivElement>('error-message')

let currentResolution = DEFAULT_RESOLUTION
let viewer: SurfaceViewer | null = null

void initialize()

async function initialize(): Promise<void> {
  await customElements.whenDefined('math-field')

  configureFormulaField()
  setFormulaLatex(DEFAULT_LATEX)
  rangeInput.value = String(DEFAULT_RANGE)
  setResolution(DEFAULT_RESOLUTION)

  try {
    viewer = new SurfaceViewer(viewerHost)
  } catch (error) {
    showError(getErrorMessage(error) || '初始化三维视图失败')
    throw error
  }

  formulaField.addEventListener('input', () => {
    showError('')
  })

  generateButton.addEventListener('click', () => {
    try {
      const expression = latexToRaw(getFormulaLatex())
      const range = normalizeRangeInput(rangeInput.value)
      rangeInput.value = String(range)
      getViewer().updateFormula(expression, {
        range,
        resolution: currentResolution,
      })
      showError('')
    } catch (error) {
      showError(getErrorMessage(error) || '生成图像失败，请检查函数')
    }
  })

  resetFormulaButton.addEventListener('click', () => {
    setFormulaLatex(DEFAULT_LATEX)
    rangeInput.value = String(DEFAULT_RANGE)
    setResolution(MEDIUM_RESOLUTION)

    try {
      getViewer().updateFormula(DEFAULT_EXPRESSION, {
        range: DEFAULT_RANGE,
        resolution: DEFAULT_RESOLUTION,
      })
      getViewer().resetCamera()
      showError('')
    } catch (error) {
      showError(getErrorMessage(error) || '恢复默认失败')
    }
  })

  resetViewButton.addEventListener('click', () => {
    getViewer().resetCamera()
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
}

function configureFormulaField(): void {
  formulaField.defaultMode = 'math'
  formulaField.letterShapeStyle = 'tex'
  formulaField.mathVirtualKeyboardPolicy = 'auto'
  formulaField.smartFence = true
  formulaField.smartMode = true
  formulaField.smartSuperscript = true
  formulaField.placeholder = '例如：x^2+y^2 或 x^2+y^2+z^2=9'
}

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

function getFormulaLatex(): string {
  return (formulaField.getValue('latex') || formulaField.value || '').trim()
}

function setFormulaLatex(latex: string): void {
  formulaField.value = latex
  formulaField.setValue(latex)
}

function getViewer(): SurfaceViewer {
  if (!viewer) {
    throw new Error('三维视图尚未初始化')
  }

  return viewer
}

function showError(message: string): void {
  errorMessage.textContent = message
  errorMessage.hidden = !message
}

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) {
    throw new Error(`页面缺少元素：${id}`)
  }
  return element as T
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
