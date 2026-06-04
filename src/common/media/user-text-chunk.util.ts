/** WeChat `msg_sec_check` content size limit (500KB per request). */
export const WECHAT_MSG_SEC_CHECK_MAX_BYTES = 480_000;

/** Split UTF-8 text into chunks within WeChat msg_sec_check size limits. */
export function* chunkTextForWechatSecCheck(
  content: string,
): Generator<string> {
  const buf = Buffer.from(content, 'utf8');
  if (buf.length <= WECHAT_MSG_SEC_CHECK_MAX_BYTES) {
    yield content;
    return;
  }

  let offset = 0;
  while (offset < buf.length) {
    let end = Math.min(offset + WECHAT_MSG_SEC_CHECK_MAX_BYTES, buf.length);
    while (end > offset && (buf[end]! & 0xc0) === 0x80) {
      end -= 1;
    }
    if (end <= offset) {
      end = Math.min(offset + WECHAT_MSG_SEC_CHECK_MAX_BYTES, buf.length);
    }
    yield buf.subarray(offset, end).toString('utf8');
    offset = end;
  }
}
