import { normalizeMathExpression } from './FormulaFormatter'

const FUNCTION_COMMANDS = new Map<string, string>([
  ['sin', 'sin'],
  ['cos', 'cos'],
  ['tan', 'tan'],
  ['log', 'log'],
  ['exp', 'exp'],
  ['abs', 'abs'],
])

const SIMPLE_COMMANDS = new Map<string, string>([
  ['pi', 'pi'],
  ['cdot', '*'],
  ['times', '*'],
  ['div', '/'],
])

export function latexToRaw(latex: string): string {
  const source = latex.replace(/\s+/g, '').trim()
  if (!source) {
    throw new Error('公式不能为空')
  }

  try {
    const parser = new LatexParser(source)
    const raw = parser.parse()
    if (!raw.trim()) {
      throw new Error('公式不能为空')
    }

    return normalizeMathExpression(raw)
  } catch (error) {
    if (error instanceof Error && error.message === '公式不能为空') {
      throw error
    }

    throw new Error('当前公式暂不支持，请换一种写法')
  }
}

class LatexParser {
  private readonly source: string
  private index = 0

  constructor(source: string) {
    this.source = source
  }

  parse(): string {
    return this.parseExpression()
  }

  private parseExpression(stopChar?: string): string {
    let output = ''

    while (this.index < this.source.length) {
      const char = this.current()

      if (stopChar && char === stopChar) {
        break
      }

      if (char === '\\') {
        output += this.parseCommand()
        continue
      }

      if (char === '{') {
        output += this.parseGroup()
        continue
      }

      if (char === '}') {
        break
      }

      if (char === '^') {
        this.index += 1
        output += `^${this.parseExponent()}`
        continue
      }

      if (char === '_') {
        this.index += 1
        this.parseAtom()
        continue
      }

      if (char === '[') {
        output += '('
        this.index += 1
        continue
      }

      if (char === ']') {
        output += ')'
        this.index += 1
        continue
      }

      output += char
      this.index += 1
    }

    return output
  }

  private parseCommand(): string {
    this.expect('\\')
    const command = this.readCommandName()

    if (!command) {
      return this.parseEscapedSymbol()
    }

    if (command === 'left' || command === 'right') {
      return this.parseDelimiter()
    }

    if (command === 'sqrt') {
      return `sqrt(${this.parseGroupOrAtom()})`
    }

    if (command === 'frac') {
      const numerator = this.parseRequiredGroup()
      const denominator = this.parseRequiredGroup()
      return `(${numerator})/(${denominator})`
    }

    if (command === 'operatorname' || command === 'mathrm') {
      return this.parseRequiredGroup()
    }

    const simple = SIMPLE_COMMANDS.get(command)
    if (simple !== undefined) {
      return simple
    }

    const fn = FUNCTION_COMMANDS.get(command)
    if (fn !== undefined) {
      return fn
    }

    if (command === ',' || command === '!' || command === ';' || command === ':') {
      return ''
    }

    if (command === 'quad' || command === 'qquad') {
      return ''
    }

    throw new Error(`不支持的 LaTeX 命令：${command}`)
  }

  private parseDelimiter(): string {
    if (this.index >= this.source.length) {
      return ''
    }

    if (this.current() === '\\') {
      this.index += 1
      const escaped = this.readCommandName()
      if (escaped === 'lbrace') {
        return '('
      }
      if (escaped === 'rbrace') {
        return ')'
      }
      return ''
    }

    const delimiter = this.current()
    this.index += 1

    if (delimiter === '(' || delimiter === '[') {
      return '('
    }

    if (delimiter === ')' || delimiter === ']') {
      return ')'
    }

    if (delimiter === '|') {
      return ''
    }

    return delimiter
  }

  private parseGroupOrAtom(): string {
    if (this.current() === '{') {
      return this.parseGroup()
    }

    return this.parseAtom()
  }

  private parseRequiredGroup(): string {
    if (this.current() !== '{') {
      throw new Error('LaTeX 缺少花括号分组')
    }

    return this.parseGroup()
  }

  private parseGroup(): string {
    this.expect('{')
    const value = this.parseExpression('}')
    this.expect('}')
    return value
  }

  private parseAtom(): string {
    if (this.index >= this.source.length) {
      return ''
    }

    const char = this.current()
    if (char === '\\') {
      return this.parseCommand()
    }

    if (char === '{') {
      return this.parseGroup()
    }

    this.index += 1
    return char
  }

  private parseExponent(): string {
    const exponent = this.parseGroupOrAtom()
    return exponent.length <= 1 ? exponent : `(${exponent})`
  }

  private parseEscapedSymbol(): string {
    if (this.index >= this.source.length) {
      return ''
    }

    const char = this.current()
    this.index += 1
    return char
  }

  private readCommandName(): string {
    const start = this.index
    while (this.index < this.source.length && /[a-zA-Z]/.test(this.current())) {
      this.index += 1
    }
    return this.source.slice(start, this.index)
  }

  private current(): string {
    return this.source[this.index] ?? ''
  }

  private expect(expected: string): void {
    if (this.current() !== expected) {
      throw new Error(`LaTeX 缺少 ${expected}`)
    }
    this.index += 1
  }
}
