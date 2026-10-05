export type RpgFormulaVariables = Record<string, number>;

export type RpgFormulaResult = {
  expression: string;
  ok: boolean;
  value: number;
  error?: string;
};

type Token =
  | { type: 'number'; value: number }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: '+' | '-' | '*' | '/' | '(' | ')' | '<' | '>' | '<=' | '>=' | '==' | '!=' }
  | { type: 'dice'; count: number; sides: number };

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const diceMatch = expression.slice(index).match(/^(\d*)d(\d+)/i);
    if (diceMatch) {
      tokens.push({
        count: diceMatch[1] ? Number(diceMatch[1]) : 1,
        sides: Number(diceMatch[2]),
        type: 'dice',
      });
      index += diceMatch[0].length;
      continue;
    }

    const numberMatch = expression.slice(index).match(/^\d+(?:\.\d+)?/);
    if (numberMatch) {
      tokens.push({ type: 'number', value: Number(numberMatch[0]) });
      index += numberMatch[0].length;
      continue;
    }

    const identifierMatch = expression.slice(index).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (identifierMatch) {
      tokens.push({ type: 'identifier', value: identifierMatch[0] });
      index += identifierMatch[0].length;
      continue;
    }

    const twoCharOperator = expression.slice(index, index + 2);
    if (['<=', '>=', '==', '!='].includes(twoCharOperator)) {
      tokens.push({ type: 'operator', value: twoCharOperator as '<=' | '>=' | '==' | '!=' });
      index += 2;
      continue;
    }

    if (['+', '-', '*', '/', '(', ')', '<', '>'].includes(char)) {
      tokens.push({ type: 'operator', value: char as '+' | '-' | '*' | '/' | '(' | ')' | '<' | '>' });
      index += 1;
      continue;
    }

    throw new Error(`Token invalido: ${char}`);
  }

  return tokens;
}

function averageDice(count: number, sides: number) {
  if (!Number.isFinite(count) || !Number.isFinite(sides) || count < 0 || sides <= 0) {
    throw new Error('Dados invalidos.');
  }

  return count * ((sides + 1) / 2);
}

function rollDice(count: number, sides: number) {
  if (!Number.isInteger(count) || !Number.isInteger(sides) || count < 0 || sides <= 0 || count > 100 || sides > 1000) {
    throw new Error('Dados invalidos.');
  }

  let total = 0;
  for (let roll = 0; roll < count; roll += 1) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
}

function parseTokens(tokens: Token[], variables: RpgFormulaVariables, diceMode: 'average' | 'roll') {
  let index = 0;

  function current() {
    return tokens[index];
  }

  function consumeOperator(value: string) {
    const token = current();
    if (token?.type === 'operator' && token.value === value) {
      index += 1;
      return true;
    }

    return false;
  }

  function parseFactor(): number {
    if (consumeOperator('+')) {
      return parseFactor();
    }

    if (consumeOperator('-')) {
      return -parseFactor();
    }

    const token = current();
    if (!token) {
      throw new Error('Expressao incompleta.');
    }

    if (token.type === 'number') {
      index += 1;
      return token.value;
    }

    if (token.type === 'dice') {
      index += 1;
      return diceMode === 'roll' ? rollDice(token.count, token.sides) : averageDice(token.count, token.sides);
    }

    if (token.type === 'identifier') {
      index += 1;
      if (!(token.value in variables)) {
        throw new Error(`Variavel desconhecida: ${token.value}`);
      }
      return variables[token.value];
    }

    if (consumeOperator('(')) {
      const value = parseExpression();
      if (!consumeOperator(')')) {
        throw new Error('Feche os parenteses da formula.');
      }
      return value;
    }

    throw new Error('Expressao invalida.');
  }

  function parseTerm(): number {
    let value = parseFactor();

    let token = current();
    while (token?.type === 'operator' && (token.value === '*' || token.value === '/')) {
      const operator = token.value;
      index += 1;
      const next = parseFactor();

      if (operator === '*') {
        value *= next;
      } else {
        if (next === 0) {
          throw new Error('Divisao por zero.');
        }
        value /= next;
      }
      token = current();
    }

    return value;
  }

  function parseSum(): number {
    let value = parseTerm();

    let token = current();
    while (token?.type === 'operator' && (token.value === '+' || token.value === '-')) {
      const operator = token.value;
      index += 1;
      const next = parseTerm();
      value = operator === '+' ? value + next : value - next;
      token = current();
    }

    return value;
  }

  function parseExpression(): number {
    let value = parseSum();
    let token = current();

    while (token?.type === 'operator' && ['<', '>', '<=', '>=', '==', '!='].includes(token.value)) {
      const operator = token.value;
      index += 1;
      const next = parseSum();

      if (operator === '<') {
        value = value < next ? 1 : 0;
      } else if (operator === '>') {
        value = value > next ? 1 : 0;
      } else if (operator === '<=') {
        value = value <= next ? 1 : 0;
      } else if (operator === '>=') {
        value = value >= next ? 1 : 0;
      } else if (operator === '==') {
        value = value === next ? 1 : 0;
      } else {
        value = value !== next ? 1 : 0;
      }

      token = current();
    }

    return value;
  }

  const value = parseExpression();
  if (index < tokens.length) {
    throw new Error('Formula contem texto extra.');
  }

  return value;
}

export function evaluateFormula(expression: string, variables: RpgFormulaVariables = {}): RpgFormulaResult {
  try {
    const value = parseTokens(tokenize(expression), variables, 'average');

    return {
      expression,
      ok: true,
      value: Number(value.toFixed(2)),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Formula invalida.',
      expression,
      ok: false,
      value: 0,
    };
  }
}

export function rollFormula(expression: string, variables: RpgFormulaVariables = {}): RpgFormulaResult {
  try {
    const value = parseTokens(tokenize(expression), variables, 'roll');

    return {
      expression,
      ok: true,
      value: Number(value.toFixed(2)),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Rolagem invalida.',
      expression,
      ok: false,
      value: 0,
    };
  }
}
