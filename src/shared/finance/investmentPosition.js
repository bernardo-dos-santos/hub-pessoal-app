// The rule that turns an asset's movements into its position — plain JS so the
// app and the server (the Íris's add_investment_contribution) share one copy.
// It used to be duplicated in server/jarvis/tools/finance.js with a comment
// asking to keep both in sync.

/** Amount of a movement in reais. A BRL asset has rate 1. */
function amountInBrl(movement) {
  return Math.abs(movement.amount) * (movement.exchangeRate ?? 1);
}

function byDateAsc(first, second) {
  return first.date.localeCompare(second.date) || (first.createdAt ?? '').localeCompare(second.createdAt ?? '');
}

/**
 * `totalInvested` is money in minus money out, each converted at its own day's
 * rate. `currentValue` is the last valuation **plus** what moved after it — a
 * contribution made after the last update used to vanish from the value until
 * the next valuation (and a withdrawal didn't lower it). With no valuation at
 * all it is the total invested.
 */
export function calculatePosition(movements) {
  const ordered = [...movements].sort(byDateAsc);

  let totalInvested = 0;
  let totalInvestedInAssetCurrency = 0;
  let currentValue = 0;
  let currentValueInAssetCurrency = 0;
  let quantity = 0;
  let lastValuationDate = null;

  for (const movement of ordered) {
    const brl = amountInBrl(movement);
    const asset = Math.abs(movement.amount);
    if (movement.type === 'contribution') {
      totalInvested += brl;
      totalInvestedInAssetCurrency += asset;
      currentValue += brl;
      currentValueInAssetCurrency += asset;
      quantity += movement.quantity ?? 0;
    } else if (movement.type === 'withdrawal') {
      totalInvested -= brl;
      totalInvestedInAssetCurrency -= asset;
      currentValue = Math.max(0, currentValue - brl);
      currentValueInAssetCurrency = Math.max(0, currentValueInAssetCurrency - asset);
      quantity -= movement.quantity ?? 0;
    } else {
      currentValue = brl;
      currentValueInAssetCurrency = asset;
      lastValuationDate = movement.date;
      // A valuation can carry the broker's real quantity, fixing splits that no
      // contribution recorded.
      if (movement.quantity !== undefined) quantity = movement.quantity;
    }
  }

  return {
    totalInvested,
    totalInvestedInAssetCurrency,
    currentValue,
    currentValueInAssetCurrency,
    quantity,
    lastValuationDate,
    movementCount: ordered.length,
  };
}

