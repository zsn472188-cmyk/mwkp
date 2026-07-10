import { normalizeMathExpression } from '../input/FormulaFormatter'

export type SurfaceEvaluator = (x: number, y: number) => number
export type ImplicitEvaluator = (x: number, y: number, z: number) => number

type TokenKind = 'number' | 'identifier' | 'operator' | 'leftParen' | 'rightParen' | 'end'
type BinaryOperator = '+' | '-' | '*' | '/' | '^'
type UnaryOperator = '+' | '-'
type VariableName = 'x' | 'y' | 'z'
type ConstantName = 'pi' | 'e'
type FunctionName = 'sin' | 'cos' | 'tan' | 'sqrt' | 'abs' | 'exp' | 'log'

interface Token {
  kind: TokenKind
  value: string
  index: number
  numericValue?: number
}

type AstNode =
  | { type: 'number'; value: number }
  | { type: 'variable'; name: VariableName }
  | { type: 'constant'; name: ConstantName }
  | { type: 'unary'; operator: UnaryOperator; argument: AstNode }
  | { type: 'binary'; operator: BinaryOperator; left: AstNode; right: AstNode }
  | { type: 'call'; name: FunctionName; argument: AstNode }

interface ParserOptions {
  allowedVariables: VariableName[]
}

const SUPPORTED_FUNCTIONS: FunctionName[] = [
  'sin',
  'cos',
  'tan',
  'sqrt',
  'abs',
  'exp',
  'log',
]

const FUNCTION_EVALUATORS: Record<FunctionName, (value: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  log: Math.log,
}

/**
 * 将 z=f(x,y) 右侧表达式编译为安全求值函数。
 * 这里使用受限词法分析 + 递归下降解析，不执行任意 JavaScript。
 */
export function compileExpression(expression: string): SurfaceEvaluator {
  const ast = compileAst(removeExplicitPrefix(expression), ['x', 'y'])
  return (x: number, y: number): number => evaluateAst(ast, x, y, 0)
}

/**
 * 将 F(x,y,z)=0 或 F(x,y,z) 编译为标量场函数。
 * 如果用户输入 left=right，最终求值为 left-right。
 */
export function compileImplicitExpression(expression: string): ImplicitEvaluator {
  const normalized = normalizeExpression(normalizeMathExpression(expression))
  const equalsCount = countCharacter(normalized, '=')

  if (equalsCount > 1) {
    throw new Error('公式中最多只能有一个等号')
  }

  if (equalsCount === 0) {
    const ast = compileAst(normalized, ['x', 'y', 'z'])
    return (x: number, y: number, z: number): number => evaluateAst(ast, x, y, z)
  }

  const [leftText, rightText] = normalized.split('=').map((part) => part.trim())

  if (!leftText || !rightText) {
    throw new Error('等号左右两侧都不能为空')
  }

  const leftAst = compileAst(leftText, ['x', 'y', 'z'])
  const rightAst = compileAst(rightText, ['x', 'y', 'z'])

  return (x: number, y: number, z: number): number => (
    evaluateAst(leftAst, x, y, z) - evaluateAst(rightAst, x, y, z)
  )
}

function compileAst(expression: string, allowedVariables: VariableName[]): AstNode {
  const source = normalizeExpression(normalizeMathExpression(expression))
  const tokens = tokenize(source)
  const options = { allowedVariables }
  validateNoImplicitMultiplication(tokens, options)
  return new Parser(tokens, options).parse()
}

function removeExplicitPrefix(expression: string): string {
  return expression.trim().replace(/^z\s*=/i, '').trim()
}

function normalizeExpression(expression: string): string {
  const normalized = expression.trim().toLowerCase()

  if (!normalized) {
    throw new Error('表达式不能为空')
  }

  return normalized
}

function countCharacter(text: string, target: string): number {
  let count = 0
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === target) count += 1
  }
  return count
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
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

      const text = source.slice(start, index)
      const value = Number(text)
      if (Number.isNaN(value)) {
        throw new Error(`第${start + 1}个字符附近的数字格式不正确`)
      }

      tokens.push({ kind: 'number', value: text, index: start, numericValue: value })
      continue
    }

    if (isLetter(char)) {
      const start = index
      while (index < source.length && isLetter(source[index])) index += 1
      tokens.push({ kind: 'identifier', value: source.slice(start, index), index: start })
      continue
    }

    if (char === '(') {
      tokens.push({ kind: 'leftParen', value: char, index })
      index += 1
      continue
    }

    if (char === ')') {
      tokens.push({ kind: 'rightParen', value: char, index })
      index += 1
      continue
    }

    if (isOperator(char)) {
      tokens.push({ kind: 'operator', value: char, index })
      index += 1
      continue
    }

    throw new Error(`第${index + 1}个字符附近有不支持的字符：${char}`)
  }

  tokens.push({ kind: 'end', value: '', index: source.length })
  return tokens
}

function validateNoImplicitMultiplication(tokens: Token[], options: ParserOptions): void {
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const left = tokens[index]
    const right = tokens[index + 1]

    if (right.kind === 'end' || !canEndValue(left, options) || !canStartValue(right)) {
      continue
    }

    if (left.kind === 'identifier' && isFunctionCallStart(left, right, options)) {
      continue
    }

    if (left.kind === 'number' && right.kind === 'identifier') {
      throw new Error('数字和变量之间必须使用乘号')
    }

    if (isValueIdentifier(left, options) && right.kind === 'identifier') {
      throw new Error('变量之间必须使用乘号')
    }

    throw new Error(`第${right.index + 1}个字符附近缺少运算符，如需相乘请使用 *`)
  }
}

class Parser {
  private current = 0
  private readonly tokens: Token[]
  private readonly options: ParserOptions

  public constructor(tokens: Token[], options: ParserOptions) {
    this.tokens = tokens
    this.options = options
  }

  public parse(): AstNode {
    const node = this.parseExpression()
    const token = this.peek()

    if (token.kind !== 'end') {
      throw new Error(`第${token.index + 1}个字符附近有多余内容`)
    }

    return node
  }

  private parseExpression(): AstNode {
    return this.parseAddSub()
  }

  private parseAddSub(): AstNode {
    let node = this.parseMulDiv()

    while (this.matchOperator('+') || this.matchOperator('-')) {
      const operator = this.previous().value as BinaryOperator
      const right = this.parseMulDiv()
      node = { type: 'binary', operator, left: node, right }
    }

    return node
  }

  private parseMulDiv(): AstNode {
    let node = this.parseUnary()

    while (this.matchOperator('*') || this.matchOperator('/')) {
      const operator = this.previous().value as BinaryOperator
      const right = this.parseUnary()
      node = { type: 'binary', operator, left: node, right }
    }

    return node
  }

  private parseUnary(): AstNode {
    if (this.matchOperator('+') || this.matchOperator('-')) {
      const operator = this.previous().value as UnaryOperator
      return { type: 'unary', operator, argument: this.parseUnary() }
    }

    return this.parsePower()
  }

  private parsePower(): AstNode {
    const left = this.parsePrimary()

    if (this.matchOperator('^')) {
      return {
        type: 'binary',
        operator: '^',
        left,
        right: this.parseUnary(),
      }
    }

    return left
  }

  private parsePrimary(): AstNode {
    if (this.matchKind('number')) {
      return { type: 'number', value: this.previous().numericValue ?? 0 }
    }

    if (this.matchKind('identifier')) {
      return this.parseIdentifier(this.previous())
    }

    if (this.matchKind('leftParen')) {
      const node = this.parseExpression()
      this.consumeRightParen()
      return node
    }

    const token = this.peek()
    if (token.kind === 'end') {
      throw new Error(`第${token.index + 1}个字符附近表达式不完整`)
    }

    throw new Error(`第${token.index + 1}个字符附近缺少数字、变量、函数或左括号`)
  }

  private parseIdentifier(identifier: Token): AstNode {
    const name = identifier.value

    if (this.matchKind('leftParen')) {
      if (!isSupportedFunction(name)) {
        throw new Error(`不支持的函数：${name}`)
      }

      if (this.peek().kind === 'rightParen') {
        throw new Error(`函数 ${name} 缺少参数`)
      }

      const argument = this.parseExpression()
      this.consumeRightParen()
      return { type: 'call', name, argument }
    }

    if (isAllowedVariableName(name, this.options)) {
      return { type: 'variable', name }
    }

    if (name === 'pi' || name === 'e') {
      return { type: 'constant', name }
    }

    if (isSupportedFunction(name)) {
      throw new Error(`函数 ${name} 调用需要使用括号，例如 ${name}(x)`)
    }

    if (/^[xyz]+$/.test(name)) {
      throw new Error('变量之间必须使用乘号')
    }

    throw new Error(`不支持的变量或常量：${name}`)
  }

  private consumeRightParen(): void {
    if (this.matchKind('rightParen')) return
    const token = this.peek()
    throw new Error(`第${token.index + 1}个字符附近缺少右括号`)
  }

  private matchKind(kind: TokenKind): boolean {
    if (this.peek().kind !== kind) return false
    this.current += 1
    return true
  }

  private matchOperator(operator: string): boolean {
    const token = this.peek()
    if (token.kind !== 'operator' || token.value !== operator) return false
    this.current += 1
    return true
  }

  private peek(): Token {
    return this.tokens[this.current]
  }

  private previous(): Token {
    return this.tokens[this.current - 1]
  }
}

function evaluateAst(node: AstNode, x: number, y: number, z: number): number {
  switch (node.type) {
    case 'number':
      return node.value
    case 'variable':
      if (node.name === 'x') return x
      if (node.name === 'y') return y
      return z
    case 'constant':
      return node.name === 'pi' ? Math.PI : Math.E
    case 'unary': {
      const value = evaluateAst(node.argument, x, y, z)
      return node.operator === '-' ? -value : value
    }
    case 'binary': {
      const left = evaluateAst(node.left, x, y, z)
      const right = evaluateAst(node.right, x, y, z)

      switch (node.operator) {
        case '+':
          return left + right
        case '-':
          return left - right
        case '*':
          return left * right
        case '/':
          return left / right
        case '^':
          return Math.pow(left, right)
      }
    }
    case 'call':
      return FUNCTION_EVALUATORS[node.name](evaluateAst(node.argument, x, y, z))
  }
}

function canEndValue(token: Token, options: ParserOptions): boolean {
  return token.kind === 'number' || token.kind === 'rightParen' || isValueIdentifier(token, options)
}

function canStartValue(token: Token): boolean {
  return token.kind === 'number' || token.kind === 'identifier' || token.kind === 'leftParen'
}

function isValueIdentifier(token: Token, options: ParserOptions): boolean {
  if (token.kind !== 'identifier') return false
  return isAllowedVariableName(token.value, options) || token.value === 'pi' || token.value === 'e'
}

function isFunctionCallStart(left: Token, right: Token, options: ParserOptions): boolean {
  return left.kind === 'identifier' && right.kind === 'leftParen' && !isValueIdentifier(left, options)
}

function isAllowedVariableName(name: string, options: ParserOptions): name is VariableName {
  return options.allowedVariables.includes(name as VariableName)
}

function isSupportedFunction(name: string): name is FunctionName {
  return SUPPORTED_FUNCTIONS.includes(name as FunctionName)
}

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r'
}

function isDigit(char: string | undefined): boolean {
  return !!char && char >= '0' && char <= '9'
}

function isLetter(char: string | undefined): boolean {
  return !!char && char >= 'a' && char <= 'z'
}

function isOperator(char: string): boolean {
  return char === '+' || char === '-' || char === '*' || char === '/' || char === '^'
}
