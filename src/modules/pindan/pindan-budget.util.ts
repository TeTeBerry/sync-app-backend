export function ensureBudgetLabelHasYuan(label: string): string {
  const trimmed = label.trim();
  if (!trimmed || /[¥￥]/.test(trimmed)) return label;
  if (/^约/.test(trimmed)) {
    return trimmed.replace(/^约(?=[\d])/, '约¥');
  }
  if (/^[\d]/.test(trimmed)) {
    return `¥${trimmed}`;
  }
  return label;
}

export function formatPindanBudgetRangeLabel(pindan: {
  budgetMin?: number;
  budgetMax?: number;
  price?: number;
}): string | undefined {
  if (pindan.budgetMin != null && pindan.budgetMax != null) {
    if (pindan.budgetMin === pindan.budgetMax) {
      return `约¥${pindan.budgetMin}/人`;
    }
    return `¥${pindan.budgetMin}-${pindan.budgetMax}/人`;
  }
  if (pindan.price != null && pindan.price > 0) {
    return `约¥${pindan.price}/人`;
  }
  return undefined;
}
