import type { TravelPlanReceiptCategory } from '../dto/recognize-travel-plan-receipt.dto';

const CATEGORY_HINT: Record<TravelPlanReceiptCategory, string> = {
  transport:
    '交通票务：高铁/火车/机票/打车/网约车订单。提取车次航班、座位舱位、起止站。若截图为往返机票/联程票，必须拆成多段单程分别识别。',
  hotel: '住宿订单：酒店/民宿预订。提取酒店名、房型、入住退房日期、是否含早。',
  dining: '餐饮小票：餐厅/外卖订单。提取店名、菜品摘要、就餐时间。',
  event: '活动门票：演出/音乐节/展会票务。提取活动名、场次日期、票档座位。',
};

function buildLegFieldSpec(category: TravelPlanReceiptCategory): string[] {
  if (category === 'hotel') {
    return [
      '- title: 行程标题（20字内，如「入住深圳湾万豪酒店」）',
      '- description: 描述摘要（60字内，如房型/是否含早/入住几晚）',
      '- cost: 费用（仅当截图中该数字旁有 ¥/￥/元 时填写；输出纯数字，不含货币符号）',
      '- remark: 备注（预订号等；勿输出姓名、手机号、身份证号）',
      '- startDate: 入住日期 YYYY-MM-DD（也可用 checkInDate）',
      '- endDate: 退房日期 YYYY-MM-DD（离店日，非末晚；也可用 checkOutDate）',
    ];
  }

  const fields = [
    '- title: 行程标题（20字内，如「飞往深圳」）',
    '- description: 描述摘要（60字内，如航班号/车次/舱位/起止站）',
    '- cost: 该段费用（仅当截图中该数字旁有 ¥/￥/元 时填写；输出纯数字，不含货币符号）',
    '- remark: 备注（预订号/取票号等；勿输出姓名、手机号、身份证号）',
    '- startDate: 出发/开始日期 YYYY-MM-DD',
    '- endDate: 到达/结束日期 YYYY-MM-DD（单程同日则与 startDate 相同）',
  ];

  if (category === 'transport') {
    fields.push(
      '- startTime: 出发时刻 HH:mm（如 12:55）',
      '- endTime: 到达时刻 HH:mm（如 15:25；跨日航班也填到达时刻）',
    );
  }

  return fields;
}

export function buildTravelPlanReceiptSystemPrompt(
  category: TravelPlanReceiptCategory,
): string {
  const lines = [
    '你是行程小票识别助手，从用户上传的订单/小票截图中提取结构化信息。',
    `当前类型：${CATEGORY_HINT[category]}`,
    '只输出 JSON，顶层字段：',
    '- ready: 是否识别成功（true/false）',
    '- orderTotal: 订单卡片底部的整单总价（仅当底部有 ¥/￥ 总计如 ¥1536 时填写；纯数字）',
    '- legs: 行程段数组，每段为一条独立单程/单次行程',
    'legs 中每段对象字段：',
    ...buildLegFieldSpec(category),
  ];

  if (category === 'hotel') {
    lines.push(
      '住宿订单规则：',
      '- legs 只含 1 段',
      '- startDate/endDate 必须分别对应入住日与退房日（离店日）',
      '- 入住 1 晚：入住 6/12、退房 6/13；不可把入住/退房写成同一天（除非当日钟点房）',
      '- 若订单只写「入住 N 晚」，退房日 = 入住日 + N 天',
      '- 只提取日期，不要识别或输出入住/退房的具体时刻（如 15:00、12:00）',
      '- 行程时间线按入住日期与退房日期排序，不含具体时分',
    );
  } else if (category === 'transport') {
    lines.push(
      '交通票务拆分规则：',
      '- 往返机票、往返高铁/火车订单：必须输出 2 段 legs（去程、返程各一段），每段只含该程航班/车次与日期',
      '- 联程/中转：按每一程输出独立 leg，不要合并成一段',
      '- 单程票：legs 只含 1 段',
      '- 携程/订单列表类截图：机票卡片底部右侧「¥1536」这类带 ¥ 的总价填入 orderTotal，不要写入各 leg 的 cost',
      '- 往返整单只有一个 ¥ 总价时：填 orderTotal，各 leg 的 cost 留空（系统会均分）',
      '- 若各程有独立 ¥ 票价，才分别填入对应 leg 的 cost',
      '- 标题建议标明方向，如「飞往深圳」「返程上海」',
      '- 航班号/车次（如 Y87566、ZH9521、CA1234）只写入 description，绝不能写入 cost 或 orderTotal',
    );
  } else {
    lines.push(
      '- 非交通类或单次订单：legs 只含 1 段',
      '- 也可兼容旧格式：无 legs 时可用顶层 title/description/cost/remark/startDate/endDate',
    );
  }

  lines.push(
    '费用识别规则：',
    '- 只有截图中明确带 ¥ / ￥ / 元 / RMB / CNY 的金额才能填入 cost',
    '- 禁止把航班号、车次、订单号、票号、座位号等编号当作费用',
    '- 找不到带货币符号的金额时，cost / orderTotal 留空或省略',
    '- 数字旁没有 ¥ / ￥ 的编号（航班号、车次、票号）一律不是金额',
    '隐私规则：禁止识别或输出任何个人姓名（乘客、入住人、预订人、联系人、乘机人等）；票据上的姓名栏直接忽略，不得写入 title/description/remark。',
    '无法识别时 ready=false，legs 可省略。',
    '日期优先从票据原文推断；只有月日时结合当前年份合理补全。',
  );

  return lines.join('\n');
}

export function buildTravelPlanReceiptUserPrompt(input: {
  activityName?: string;
  category: TravelPlanReceiptCategory;
}): string {
  return [
    input.activityName ? `关联活动：${input.activityName}` : '',
    `票据类型：${input.category}`,
    '请识别截图并填入 JSON 字段。',
  ]
    .filter(Boolean)
    .join('\n');
}
