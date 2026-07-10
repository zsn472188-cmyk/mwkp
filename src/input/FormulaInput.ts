import './formulaInput.css'
import { normalizeMathExpression, rawToDisplay } from './FormulaFormatter'
import { MathKeyboard, type KeyboardAction } from './MathKeyboard'

export interface FormulaEditorState {
  display: string
  cursor: number
}

interface FormulaInputOptions {
  displayElement: HTMLElement
  initialValue: string
}

interface SelectionRange {
  start: number
  end: number
}

export class FormulaInput {
  private readonly displayElement: HTMLElement
  private readonly keyboard: MathKeyboard
  private readonly editorInput: HTMLInputElement
  private readonly isTouchDevice = isTouchDevice()
  private state: FormulaEditorState

  public constructor(options: FormulaInputOptions) {
    this.displayElement = options.displayElement
    const initialDisplay = rawToDisplay(options.initialValue)
    this.state = {
      display: initialDisplay,
      cursor: initialDisplay.length,
    }

    this.displayElement.setAttribute('aria-haspopup', 'dialog')
    this.displayElement.setAttribute('aria-expanded', 'false')

    this.keyboard = new MathKeyboard({
      onAction: (action) => this.handleKeyboardAction(action),
    })
    this.editorInput = this.keyboard.getEditorInput()

    this.editorInput.readOnly = this.isTouchDevice
    this.editorInput.inputMode = this.isTouchDevice ? 'none' : 'text'

    this.displayElement.addEventListener('pointerdown', this.handleDisplayPointerDown)
    this.displayElement.addEventListener('keydown', this.handleDisplayKeyDown)
    this.editorInput.addEventListener('input', this.handleEditorInput)
    this.editorInput.addEventListener('click', this.handleEditorSelectionChange)
    this.editorInput.addEventListener('keyup', this.handleEditorSelectionChange)
    this.editorInput.addEventListener('select', this.handleEditorSelectionChange)
    this.editorInput.addEventListener('focus', this.handleEditorSelectionChange)
    document.addEventListener('pointerdown', this.handleDocumentPointerDown)

    this.renderDisplay()
    this.renderEditor(false)
  }

  public getValue(): string {
    this.syncStateFromEditor()
    return normalizeMathExpression(this.state.display)
  }

  public setValue(value: string): void {
    const display = rawToDisplay(value)
    this.state = {
      display,
      cursor: display.length,
    }
    this.renderDisplay()
    this.renderEditor(false)
  }

  public open(): void {
    this.keyboard.setVisible(true)
    this.displayElement.setAttribute('aria-expanded', 'true')
    this.renderEditor(true)
  }

  public close(): void {
    this.syncStateFromEditor()
    this.renderDisplay()
    this.keyboard.setVisible(false)
    this.displayElement.setAttribute('aria-expanded', 'false')
  }

  public dispose(): void {
    this.displayElement.removeEventListener('pointerdown', this.handleDisplayPointerDown)
    this.displayElement.removeEventListener('keydown', this.handleDisplayKeyDown)
    this.editorInput.removeEventListener('input', this.handleEditorInput)
    this.editorInput.removeEventListener('click', this.handleEditorSelectionChange)
    this.editorInput.removeEventListener('keyup', this.handleEditorSelectionChange)
    this.editorInput.removeEventListener('select', this.handleEditorSelectionChange)
    this.editorInput.removeEventListener('focus', this.handleEditorSelectionChange)
    document.removeEventListener('pointerdown', this.handleDocumentPointerDown)
    this.keyboard.dispose()
  }

  private handleKeyboardAction(action: KeyboardAction): void {
    if (action.type !== 'clear' && action.type !== 'confirm') {
      this.syncStateFromEditor()
    }

    switch (action.type) {
      case 'insert':
        this.insertAtCursor(action.text, action.cursorOffset ?? 0)
        return
      case 'delete':
        this.deleteBeforeCursor()
        return
      case 'move':
        this.moveCursor(action.direction)
        return
      case 'clear':
        this.setDisplayValue('')
        return
      case 'confirm':
        this.close()
        return
    }
  }

  private insertAtCursor(text: string, cursorOffset = 0): void {
    const { start, end } = this.getEditorSelectionRange()
    const insertText = resolveInsertText(text, this.editorInput.value, start)
    const nextDisplay = `${this.editorInput.value.slice(0, start)}${insertText}${this.editorInput.value.slice(end)}`
    const nextCursor = clampCursor(start + insertText.length + cursorOffset, nextDisplay.length)

    this.state = {
      display: nextDisplay,
      cursor: nextCursor,
    }
    this.renderDisplay()
    this.renderEditor(true)
  }

  private deleteBeforeCursor(): void {
    const { start, end } = this.getEditorSelectionRange()

    if (start !== end) {
      const nextDisplay = `${this.editorInput.value.slice(0, start)}${this.editorInput.value.slice(end)}`
      this.state = { display: nextDisplay, cursor: start }
      this.renderDisplay()
      this.renderEditor(true)
      return
    }

    if (start <= 0) return

    const nextCursor = start - 1
    const nextDisplay = `${this.editorInput.value.slice(0, nextCursor)}${this.editorInput.value.slice(start)}`
    this.state = {
      display: nextDisplay,
      cursor: nextCursor,
    }
    this.renderDisplay()
    this.renderEditor(true)
  }

  private moveCursor(direction: -1 | 1): void {
    const cursor = clampCursor((this.editorInput.selectionStart ?? this.state.cursor) + direction, this.editorInput.value.length)
    this.state.cursor = cursor
    this.renderEditor(true)
  }

  private setDisplayValue(display: string): void {
    this.state = {
      display,
      cursor: display.length,
    }
    this.renderDisplay()
    this.renderEditor(true)
  }

  private syncStateFromEditor(): void {
    const normalizedDisplay = normalizeDisplayInput(this.editorInput.value)
    const cursor = this.editorInput.selectionStart ?? normalizedDisplay.length
    this.state = {
      display: normalizedDisplay,
      cursor: clampCursor(cursor, normalizedDisplay.length),
    }
  }

  private syncCursorFromEditor(): void {
    this.state.cursor = clampCursor(this.editorInput.selectionStart ?? this.state.display.length, this.state.display.length)
  }

  private renderDisplay(): void {
    this.displayElement.textContent = this.state.display
    this.displayElement.classList.toggle('formula-display--empty', this.state.display.length === 0)
    this.displayElement.setAttribute('aria-label', this.state.display || '打开数学公式键盘')
  }

  private renderEditor(focusEditor: boolean): void {
    if (this.editorInput.value !== this.state.display) {
      this.editorInput.value = this.state.display
    }

    window.requestAnimationFrame(() => {
      if (focusEditor) {
        this.editorInput.focus({ preventScroll: true })
      }

      const cursor = clampCursor(this.state.cursor, this.editorInput.value.length)
      this.editorInput.setSelectionRange(cursor, cursor)
    })
  }

  private getEditorSelectionRange(): SelectionRange {
    const fallback = clampCursor(this.state.cursor, this.editorInput.value.length)
    const start = this.editorInput.selectionStart
    const end = this.editorInput.selectionEnd

    if (typeof start !== 'number' || typeof end !== 'number') {
      return { start: fallback, end: fallback }
    }

    return {
      start: clampCursor(start, this.editorInput.value.length),
      end: clampCursor(end, this.editorInput.value.length),
    }
  }

  private readonly handleDisplayPointerDown = (event: PointerEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    this.state.cursor = this.state.display.length
    this.open()
  }

  private readonly handleDisplayKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    this.state.cursor = this.state.display.length
    this.open()
  }

  private readonly handleEditorInput = (): void => {
    this.syncStateFromEditor()
    this.renderDisplay()
    this.renderEditor(false)
  }

  private readonly handleEditorSelectionChange = (): void => {
    this.syncCursorFromEditor()
  }

  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.keyboard.isVisible()) return
    if (event.target === this.displayElement || this.displayElement.contains(event.target as Node)) return
    if (this.keyboard.contains(event.target)) return
    this.close()
  }
}

function normalizeDisplayInput(value: string): string {
  return value
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/−/g, '-')
}

function resolveInsertText(text: string, display: string, cursor: number): string {
  if ((text === '²' || text === '³') && !canApplyPowerToPrevious(display[cursor - 1])) {
    return `x${text}`
  }

  return text
}

function canApplyPowerToPrevious(char: string | undefined): boolean {
  return char === 'x' || char === 'y' || char === 'z' || char === ')' || char === 'π' || char === 'e'
}

function clampCursor(cursor: number, length: number): number {
  return Math.min(length, Math.max(0, cursor))
}

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}
