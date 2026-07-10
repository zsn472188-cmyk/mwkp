import { normalizeMathExpression } from '../input/FormulaFormatter'

export type FormulaMode = 'explicit' | 'implicit'

export interface ClassifiedFormula {
  mode: FormulaMode
  normalizedExpression: string
}

/**
 * 统一公式入口：
 * - 无等号且不含 z：显函数 z=f(x,y)
 * - z=...：显函数
 * - 含 z 或普通等式：隐函数 F(x,y,z)=0
 */
export function classifyFormula(input: string): ClassifiedFormula {
  const normalized = normalizeMathExpression(input).trim().toLowerCase()

  if (!normalized) {
    throw new Error('公式不能为空')
  }

  const equalsCount = countCharacter(normalized, '=')
  if (equalsCount > 1) {
    throw new Error('公式中最多只能包含一个等号')
  }

  if (equalsCount === 1) {
    const [left, right] = normalized.split('=').map((part) => part.trim())

    if (left === 'z') {
      if (!right) {
        throw new Error('z= 右侧不能为空')
      }

      return {
        mode: 'explicit',
        normalizedExpression: right,
      }
    }

    if (!left || !right) {
      throw new Error('等号左右两侧都不能为空')
    }

    return {
      mode: 'implicit',
      normalizedExpression: normalized,
    }
  }

  return {
    mode: containsZVariable(normalized) ? 'implicit' : 'explicit',
    normalizedExpression: normalized,
  }
}

function countCharacter(text: string, target: string): number {
  let count = 0
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === target) count += 1
  }
  return count
}

function containsZVariable(expression: string): boolean {
  for (let index = 0; index < expression.length; index += 1) {
    if (expression[index] !== 'z') continue

    const previous = expression[index - 1]
    const next = expression[index + 1]
    if (!isLetter(previous) && !isLetter(next)) {
      return true
    }
  }

  return false
}

function isLetter(char: string | undefined): boolean {
  return !!char && char >= 'a' && char <= 'z'
}
