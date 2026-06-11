import { normalizeTravelPlanReceiptResult } from '../../../../src/modules/travel-plan/domain/travel-plan-receipt-normalize.util';

describe('normalizeTravelPlanReceiptResult', () => {
  it('maps a successful hotel receipt', () => {
    const result = normalizeTravelPlanReceiptResult('hotel', {
      ready: true,
      title: '入住深圳湾万豪酒店',
      description: '豪华大床房 · 含早餐 · 入住1晚',
      cost: 980,
      remark: '预订号 MARRY20240612',
      startDate: '2024-06-12',
      endDate: '2024-06-13',
    });

    expect(result.filled).toBe(true);
    expect(result.form).toEqual({
      title: '入住深圳湾万豪酒店',
      description: '豪华大床房 · 含早餐 · 入住1晚',
      cost: '980',
      remark: '预订号 MARRY20240612',
      startDate: '2024-06-12',
      endDate: '2024-06-13',
    });
  });

  it('returns unfilled when ready is false', () => {
    const result = normalizeTravelPlanReceiptResult('transport', {
      ready: false,
    });
    expect(result.filled).toBe(false);
    expect(result.form).toBeUndefined();
  });

  it('desensitizes phone numbers in remark', () => {
    const result = normalizeTravelPlanReceiptResult('dining', {
      ready: true,
      title: '海底捞',
      remark: '联系 13800138000',
      startDate: '2025-06-12',
      endDate: '2025-06-12',
    });

    expect(result.form?.remark).toBe('联系 ***');
  });

  it('strips personal names from recognized fields', () => {
    const result = normalizeTravelPlanReceiptResult('transport', {
      ready: true,
      title: '飞往深圳',
      description: 'CA1234 · 经济舱 · 乘客张三',
      remark: '预订人：李四 · 订单号 A1001',
      startDate: '2024-06-12',
      endDate: '2024-06-12',
    });

    expect(result.form?.description).toBe('CA1234 · 经济舱');
    expect(result.form?.remark).toBe('订单号 A1001');
  });

  it('maps hotel check-in and check-out dates without clock times', () => {
    const result = normalizeTravelPlanReceiptResult('hotel', {
      ready: true,
      title: '入住深圳湾万豪酒店',
      description: '豪华大床房 · 含早餐 · 入住1晚',
      checkInDate: '2024-06-12',
      checkOutDate: '2024-06-13',
      checkInTime: '15:00',
      checkOutTime: '12:00',
      cost: 980,
    });

    expect(result.form).toEqual({
      title: '入住深圳湾万豪酒店',
      description: '豪华大床房 · 含早餐 · 入住1晚',
      cost: '980',
      remark: '',
      startDate: '2024-06-12',
      endDate: '2024-06-13',
    });
  });

  it('infers hotel checkout from nights when only check-in is present', () => {
    const result = normalizeTravelPlanReceiptResult('hotel', {
      ready: true,
      title: '入住宝安大酒店',
      description: '大床房 · 入住2晚',
      startDate: '2024-06-12',
      cost: 760,
    });

    expect(result.form?.startDate).toBe('2024-06-12');
    expect(result.form?.endDate).toBe('2024-06-14');
  });

  it('rejects flight numbers mistaken as cost', () => {
    const result = normalizeTravelPlanReceiptResult('transport', {
      ready: true,
      title: '飞往深圳',
      description: 'CA1234 · 经济舱 · 上海虹桥-深圳宝安',
      cost: 1234,
      startDate: '2024-06-12',
      endDate: '2024-06-12',
    });

    expect(result.form?.cost).toBe('');
    expect(result.form?.description).toContain('CA1234');
  });

  it('uses order total for ctrip round-trip flight card', () => {
    const result = normalizeTravelPlanReceiptResult('transport', {
      ready: true,
      orderTotal: '¥1536',
      legs: [
        {
          title: '飞往深圳',
          description: 'Y87566 · 上海浦东-深圳宝安 · 06-13 12:55',
          cost: 7678,
          startDate: '2024-06-13',
          endDate: '2024-06-13',
        },
        {
          title: '返程上海',
          description: 'ZH9521 · 深圳宝安-上海浦东 · 06-15 14:50',
          cost: 87566,
          startDate: '2024-06-15',
          endDate: '2024-06-15',
        },
      ],
    });

    expect(result.forms).toHaveLength(2);
    expect(result.forms?.[0]?.cost).toBe('768');
    expect(result.forms?.[1]?.cost).toBe('768');
  });

  it('rejects flight digit strings like Y87566 as leg cost', () => {
    const result = normalizeTravelPlanReceiptResult('transport', {
      ready: true,
      title: '飞往深圳',
      description: 'Y87566 · 经济舱',
      cost: 87566,
      startDate: '2024-06-13',
      endDate: '2024-06-13',
    });

    expect(result.form?.cost).toBe('');
  });

  it('keeps currency-marked amounts as cost', () => {
    const result = normalizeTravelPlanReceiptResult('transport', {
      ready: true,
      title: '飞往深圳',
      description: 'CA1234 · 经济舱',
      cost: '¥650',
      startDate: '2024-06-12',
      endDate: '2024-06-12',
    });

    expect(result.form?.cost).toBe('650');
  });

  it('splits round-trip transport into multiple legs', () => {
    const result = normalizeTravelPlanReceiptResult('transport', {
      ready: true,
      legs: [
        {
          title: '飞往深圳',
          description: 'CA1234 · 经济舱 · 上海虹桥-深圳宝安',
          cost: 650,
          remark: '订单号 RT20240612',
          startDate: '2024-06-12',
          endDate: '2024-06-12',
        },
        {
          title: '返程上海',
          description: 'CA1235 · 经济舱 · 深圳宝安-上海虹桥',
          cost: 650,
          remark: '订单号 RT20240612',
          startDate: '2024-06-15',
          endDate: '2024-06-15',
        },
      ],
    });

    expect(result.filled).toBe(true);
    expect(result.forms).toHaveLength(2);
    expect(result.form?.title).toBe('飞往深圳');
    expect(result.message).toBe('AI 识别完成，已拆分为 2 段单程');
  });

  it('aligns receipt dates to the activity year hint', () => {
    const result = normalizeTravelPlanReceiptResult(
      'transport',
      {
        ready: true,
        title: '飞往深圳',
        description: 'Y87566 · 上海浦东-深圳宝安',
        startDate: '2024-06-13',
        endDate: '2024-06-13',
      },
      { yearHint: '2026' },
    );

    expect(result.form?.startDate).toBe('2026-06-13');
    expect(result.form?.endDate).toBe('2026-06-13');
  });

  it('parses transport times from description when startTime is missing', () => {
    const result = normalizeTravelPlanReceiptResult('transport', {
      ready: true,
      title: '飞往深圳',
      description: 'Y87566 · 上海浦东-深圳宝安 · 06-13 12:55-15:25',
      startDate: '2026-06-13',
      endDate: '2026-06-13',
    });

    expect(result.form?.startTime).toBe('12:55');
    expect(result.form?.endTime).toBe('15:25');
  });
});
