export type KeyboardAction =
  | { type: 'insert'; text: string; cursorOffset?: number }
  | { type: 'delete' }
  | { type: 'move'; direction: -1 | 1 }
  | { type: 'clear' }
  | { type: 'confirm' }

interface MathKeyboardOptions {
  onAction: (action: KeyboardAction) => void
}

interface KeyboardButton {
  label: string
  action: KeyboardAction
  variant?: 'operator' | 'control' | 'confirm'
}

interface KeyboardTab {
  id: string
  label: string
  buttons: KeyboardButton[]
}

const FUNCTION_NAMES = ['sin', 'cos', 'tan', 'sqrt', 'log', 'exp', 'abs']

const KEYBOARD_TABS: KeyboardTab[] = [
  {
    id: 'numbers',
    label: '123',
    buttons: [
      insertButton('x', 'x'),
      insertButton('y', 'y'),
      insertButton('z', 'z'),
      insertButton('π', 'π'),
      insertButton('7', '7'),
      insertButton('8', '8'),
      insertButton('9', '9'),
      insertButton('×', '×', 'operator'),
      insertButton('÷', '÷', 'operator'),

      insertButton('x²', '²'),
      insertButton('x³', '³'),
      insertButton('√', '√()', 'operator', -1),
      insertButton('e', 'e'),
      insertButton('4', '4'),
      insertButton('5', '5'),
      insertButton('6', '6'),
      insertButton('+', '+', 'operator'),
      insertButton('-', '-', 'operator'),

      insertButton('<', '<'),
      insertButton('>', '>'),
      insertButton('^', '^', 'operator'),
      insertButton('=', '=', 'operator'),
      insertButton('1', '1'),
      insertButton('2', '2'),
      insertButton('3', '3'),
      controlButton('⌫', { type: 'delete' }),
      controlButton('清空', { type: 'clear' }),

      insertButton('(', '('),
      insertButton(')', ')'),
      insertButton('abs()', 'abs()', undefined, -1),
      insertButton(',', ','),
      insertButton('0', '0'),
      insertButton('.', '.'),
      controlButton('←', { type: 'move', direction: -1 }),
      controlButton('→', { type: 'move', direction: 1 }),
      controlButton('确认', { type: 'confirm' }, 'confirm'),
    ],
  },
  {
    id: 'functions',
    label: 'f(x)',
    buttons: FUNCTION_NAMES.map((name) => (
      name === 'sqrt'
        ? insertButton('√()', '√()', 'operator', -1)
        : insertButton(`${name}()`, `${name}()`, 'operator', -1)
    )),
  },
  {
    id: 'letters',
    label: 'abc',
    buttons: [
      insertButton('x', 'x'),
      insertButton('y', 'y'),
      insertButton('z', 'z'),
      insertButton('π', 'π'),
      insertButton('e', 'e'),
    ],
  },
]

export class MathKeyboard {
  private readonly panel: HTMLDivElement
  private readonly editorInput: HTMLInputElement
  private readonly tabButtons: HTMLButtonElement[] = []
  private readonly keyGrid: HTMLDivElement
  private readonly onAction: (action: KeyboardAction) => void
  private activeTabId = KEYBOARD_TABS[0].id
  private visible = false

  public constructor(options: MathKeyboardOptions) {
    this.onAction = options.onAction
    this.panel = document.createElement('div')
    this.panel.className = 'formula-panel math-keyboard'
    this.panel.hidden = true

    const dragHandle = document.createElement('div')
    dragHandle.className = 'math-keyboard__handle'
    dragHandle.setAttribute('aria-hidden', 'true')

    this.editorInput = document.createElement('input')
    this.editorInput.type = 'text'
    this.editorInput.className = 'formula-edit-input'
    this.editorInput.autocomplete = 'off'
    this.editorInput.spellcheck = false
    this.editorInput.placeholder = '在这里编辑公式'

    const tabs = document.createElement('div')
    tabs.className = 'math-keyboard__tabs'
    for (const tab of KEYBOARD_TABS) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = tab.label
      button.dataset.tabId = tab.id
      bindKeyboardButton(button, () => this.setActiveTab(tab.id))
      this.tabButtons.push(button)
      tabs.append(button)
    }

    this.keyGrid = document.createElement('div')
    this.keyGrid.className = 'math-keyboard__grid'

    this.panel.append(dragHandle, this.editorInput, tabs, this.keyGrid)
    this.panel.addEventListener('pointerdown', stopKeyboardInteraction)
    this.panel.addEventListener('touchstart', stopKeyboardInteraction, { passive: false })
    this.panel.addEventListener('wheel', stopKeyboardInteraction, { passive: false })
    document.body.append(this.panel)
    this.renderActiveTab()
  }

  public getEditorInput(): HTMLInputElement {
    return this.editorInput
  }

  public setVisible(visible: boolean): void {
    this.visible = visible
    this.panel.hidden = !visible
    document.body.classList.toggle('math-keyboard-open', visible)

    if (visible) {
      this.updateKeyboardHeight()
    } else {
      document.documentElement.style.removeProperty('--math-keyboard-height')
    }
  }

  public isVisible(): boolean {
    return this.visible
  }

  public contains(target: EventTarget | null): boolean {
    return target instanceof Node && this.panel.contains(target)
  }

  public dispose(): void {
    this.panel.remove()
    document.body.classList.remove('math-keyboard-open')
    document.documentElement.style.removeProperty('--math-keyboard-height')
  }

  private setActiveTab(tabId: string): void {
    this.activeTabId = tabId
    this.renderActiveTab()
  }

  private renderActiveTab(): void {
    const activeTab = KEYBOARD_TABS.find((tab) => tab.id === this.activeTabId) ?? KEYBOARD_TABS[0]

    for (const button of this.tabButtons) {
      const isActive = button.dataset.tabId === activeTab.id
      button.classList.toggle('active', isActive)
      button.setAttribute('aria-pressed', String(isActive))
    }

    this.keyGrid.replaceChildren()
    for (const item of activeTab.buttons) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = item.label
      button.className = 'math-keyboard__key'
      if (item.variant) button.classList.add(`math-keyboard__key--${item.variant}`)
      bindKeyboardButton(button, () => this.onAction(item.action))
      this.keyGrid.append(button)
    }

    this.updateKeyboardHeight()
  }

  private updateKeyboardHeight(): void {
    if (!this.visible) return
    window.requestAnimationFrame(() => {
      const height = Math.ceil(this.panel.getBoundingClientRect().height)
      document.documentElement.style.setProperty('--math-keyboard-height', `${height}px`)
    })
  }
}

function insertButton(
  label: string,
  text: string,
  variant?: KeyboardButton['variant'],
  cursorOffset?: number,
): KeyboardButton {
  return {
    label,
    variant,
    action: { type: 'insert', text, cursorOffset },
  }
}

function controlButton(
  label: string,
  action: KeyboardAction,
  variant: KeyboardButton['variant'] = 'control',
): KeyboardButton {
  return { label, action, variant }
}

function bindKeyboardButton(button: HTMLButtonElement, onClick: () => void): void {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })

  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick()
  })
}

function stopKeyboardInteraction(event: Event): void {
  event.stopPropagation()
}
