type NormalizeTokenKind =
  | 'number'
  | 'identifier'
  | 'operator'
  | 'leftParen'
  | 'rightParen'
  | 'comma'
  | 'other'

type IdentifierRole = 'variable' | 'constant' | 'function' | 'unknown'

interface NormalizeToken {
  kind: NormalizeTokenKind
  value: string
  role?: IdentifierRole
}

const SUPPORTED_FUNCTIONS = ['sqrt', 'sin', 'cos', 'tan', 'log', 'exp', 'abs']
const FUNCTIONS_BY_LENGTH = [...SUPPORTED_FUNCTIONS].sort((a, b) => b.length - a.length)

const SUPERSCRIPT_TO_POWER: Record<string, string> = {
  '²': '^2',
  '³': '^3',
  '⁴': '^4',
  '⁵': '^5',
  '⁶': '^6',
  '⁷': '^7',
  '⁸': '^8',
  '⁹': '^9',
}

const POWER_TO_SUPERSCRIPT: Record<string, string> = {
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}

export function rawToDisplay(raw: string): string {
  let display = raw.trim()

  display = display.replace(/\bsqrt\s*\(/gi, '√(')
  display = display.replace(/\bpi\b/gi, 'π')
  display = display.replace(/\^([2-9])/g, (_, power: string) => POWER_TO_SUPERSCRIPT[power] ?? `^${power}`)
  display = display.replace(/\*/g, '×')
  display = display.replace(/\//g, '÷')

  return removeNaturalMultiplicationSigns(display)
}

export function displayToRaw(display: string): string {
  let raw = display.trim().toLowerCase()

  raw = raw.replace(/[²³⁴⁵⁶⁷⁸⁹]/g, (value) => SUPERSCRIPT_TO_POWER[value] ?? value)
  raw = raw.replace(/√/g, 'sqrt')
  raw = raw.replace(/π/g, 'pi')
  raw = raw.replace(/[×·]/g, '*')
  raw = raw.replace(/÷/g, '/')
  raw = raw.replace(/−/g, '-')

  return raw
}

export function normalizeMathExpression(expression: string): string {
  const raw = displayToRaw(expression)
  return raw
    .split('=')
    .map((part) => normalizeExpressionPart(part))
    .join('=')
}

function normalizeExpressionPart(source: string): string {
  const tokens = tokenizeForNormalization(source)
  let result = ''

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const nextToken = tokens[index + 1]

    result += token.value
    if (nextToken && shouldInsertMultiplication(token, nextToken)) {
      result += '*'
    }
  }

  return result
}

function tokenizeForNormalization(source: string): NormalizeToken[] {
  const tokens: NormalizeToken[] = []
  let index = 0

  while (index < source.length) {
    const char = source[index]

    if (isWhitespace(char)) {
      index += 1
      continue
    }

    if (isDigit(char) || (char === '.' && isDigit(source[index + 1]))) {
      const start = index
      let hasDot = false

      while (index < source.length) {
        const current = source[index]
        if (isDigit(current)) {
          index += 1
          continue
        }

        if (current === '.' && !hasDot) {
          hasDot = true
          index += 1
          continue
        }

        break
      }

      tokens.push({ kind: 'number', value: source.slice(start, index) })
      continue
    }

    const matchedFunction = matchFunctionAt(source, index)
    if (matchedFunction) {
      tokens.push({ kind: 'identifier', value: matchedFunction, role: 'function' })
      index += matchedFunction.length
      continue
    }

    if (source.startsWith('pi', index)) {
      tokens.push({ kind: 'identifier', value: 'pi', role: 'constant' })
      index += 2
      continue
    }

    if (char === 'e') {
      tokens.push({ kind: 'identifier', value: 'e', role: 'constant' })
      index += 1
      continue
    }

    if (char === 'x' || char === 'y' || char === 'z') {
      tokens.push({ kind: 'identifier', value: char, role: 'variable' })
      index += 1
      continue
    }

    if (isLetter(char)) {
      const start = index
      while (index < source.length && isLetter(source[index])) index += 1
      tokens.push({ kind: 'identifier', value: source.slice(start, index), role: 'unknown' })
      continue
    }

    if (char === '(') {
      tokens.push({ kind: 'leftParen', value: char })
      index += 1
      continue
    }

    if (char === ')') {
      tokens.push({ kind: 'rightParen', value: char })
      index += 1
      continue
    }

    if (char === ',') {
      tokens.push({ kind: 'comma', value: char })
      index += 1
      continue
    }

    if (isOperator(char)) {
      tokens.push({ kind: 'operator', value: char })
      index += 1
      continue
    }

    tokens.push({ kind: 'other', value: char })
    index += 1
  }

  return tokens
}

function shouldInsertMultiplication(left: NormalizeToken, right: NormalizeToken): boolean {
  if (left.role === 'function' && right.kind === 'leftParen') return false
  return canEndValue(left) && canStartValue(right)
}

function canEndValue(token: NormalizeToken): boolean {
  return (
    token.kind === 'number'
    || token.kind === 'rightParen'
    || token.role === 'variable'
    || token.role === 'constant'
  )
}

function canStartValue(token: NormalizeToken): boolean {
  return (
    token.kind === 'number'
    || token.kind === 'leftParen'
    || token.role === 'variable'
    || token.role === 'constant'
    || token.role === 'function'
  )
}

function matchFunctionAt(source: string, index: number): string | null {
  for (const name of FUNCTIONS_BY_LENGTH) {
    if (source.startsWith(name, index) && source[index + name.length] === '(') {
      return name
    }
  }

  return null
}

function removeNaturalMultiplicationSigns(display: string): string {
  let result = display
  const valueStart = String.raw`(?:[xyzπe√(]|\b(?:sin|cos|tan|log|exp|abs)\b)`

  result = result.replace(new RegExp(`([0-9.]+)×(?=${valueStart})`, 'g'), '$1')
  result = result.replace(new RegExp(`([xyzπe)])×(?=${valueStart}|[xyzπe])`, 'g'), '$1')

  return result
}

function isWhitespace(char: string | undefined): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r'
}

function isDigit(char: string | undefined): boolean {
  return !!char && char >= '0' && char <= '9'
}

function isLetter(char: string | undefined): boolean {
  return !!char && char >= 'a' && char <= 'z'
}

function isOperator(char: string): boolean {
  return char === '+' || char === '-' || char === '*' || char === '/' || char === '^' || char === '<' || char === '>'
}
