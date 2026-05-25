const CONFIRM_RE =
  /^(确认|是|好的|好|创建|发起|可以|行|要|ok|yes)$/i;

export function isPindanCreateConfirmMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (CONFIRM_RE.test(trimmed)) return true;
  return /确认创建|发起拼单|创建拼单|帮我创建|帮我发起/.test(trimmed);
}

export function isPindanCreateDeclineMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^(否|不|不用|不要|暂时不|取消|算了|先不)$/i.test(trimmed)) return true;
  return /不创建|不要创建|不用了|先不用/.test(trimmed);
}
