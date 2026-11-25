// Types for investmentPosition.js (plain JS so the server can import it too).
import type { InvestmentMovement, InvestmentPosition } from '../../modules/finance/investments/types/movement';

export function calculatePosition(movements: InvestmentMovement[]): InvestmentPosition;
