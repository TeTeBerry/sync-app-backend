import type { TravelPlanReceiptCategory } from '../dto/recognize-travel-plan-receipt.dto';

const CATEGORY_HINT: Record<TravelPlanReceiptCategory, string> = {
  transport:
    '交通票务：高铁/火车/机票/打车/网约车订单。机票火车票按单程拆分；微信/支付宝账单中的多条打车记录须按每笔拆成 legs。',
  hotel: '住宿订单：酒店/民宿预订。提取酒店名、房型、入住退房日期、是否含早。',
  dining:
    '餐饮消费：餐厅小票、外卖订单，或微信/支付宝账单列表截图。账单列表截图须按每条消费拆成多笔 legs。',
  event:
    '其他消费/票务：演出门票、展会、周边商品、景点门票、购物订单，或微信/支付宝账单/订单列表截图。须提取每条记录截图中的主标题（活动名、商品名、商户名）。',
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

  if (category === 'dining') {
    return [
      '- title: 商家名称（如「星巴克」「国展中心澳园餐厅」）',
      '- description: 消费时间摘要（如「6/15 13:53」），可含支付方式',
      '- cost: 该笔金额（支出为负数时取绝对值；仅当旁有 ¥/￥/元 或列表金额列时填写）',
      '- remark: 备注（订单号等；勿输出姓名、手机号）',
      '- startDate: 消费日期 YYYY-MM-DD',
      '- startTime: 消费时刻 HH:mm（若有）',
      '- endDate: 与 startDate 相同（单笔消费）',
    ];
  }

  if (category === 'event') {
    return [
      '- title: 截图中该条记录的主标题（必填；优先活动名/演出名/商品名/商户名/订单标题，20字内）',
      '- description: 场次或消费时间摘要（如「6/15 19:30」）、票档/规格/场馆',
      '- cost: 该笔金额（支出为负数时取绝对值；仅当旁有 ¥/￥/元 或列表金额列时填写）',
      '- remark: 备注（订单号/票号等；勿输出姓名、手机号）',
      '- startDate: 发生日期 YYYY-MM-DD',
      '- startTime: 时刻 HH:mm（若有）',
      '- endDate: 与 startDate 相同（单笔记录）',
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
      '打车/网约车账单规则：',
      '- 微信/支付宝「账单」中的滴滴、高德打车、曹操出行等：每条打车记录输出 1 条 leg',
      '- title: 平台或商户名（如「滴滴出行」「高德打车」），可加起终点摘要',
      '- description: 乘车时间（如「6/15 13:53」）或起终点',
      '- cost: 该笔车费（支出负数取绝对值）',
      '- startDate/startTime: 乘车日期与时刻',
      '- 月支出汇总行不要作为 leg，也不要填入 orderTotal',
    );
  } else if (category === 'dining') {
    lines.push(
      '餐饮账单规则：',
      '- 微信/支付宝「账单」列表、银行交易记录：每条可见消费记录输出 1 条 leg，不要合并',
      '- 单笔小票/外卖订单：legs 只含 1 段',
      '- 月支出/收入汇总行（如 Expenditures ¥2075）不要作为 leg，也不要填入 orderTotal',
      '- 每笔 leg 的 cost 填该笔右侧金额；各笔金额已知时不要填 orderTotal',
      '- 列表中「-33.00」这类支出金额取绝对值写入 cost',
    );
  } else if (category === 'event') {
    lines.push(
      '其他消费/票务规则：',
      '- 微信/支付宝「账单」列表、购物/票务订单列表：每条可见记录输出 1 条 leg，不要合并',
      '- 每条 leg 的 title 必须填写截图中该条记录的主标题（活动名、商品名、商户名、订单标题），不可留空',
      '- 单笔门票/购物订单：legs 只含 1 段',
      '- 月支出/收入汇总行不要作为 leg，也不要填入 orderTotal',
      '- 每笔 leg 的 cost 填该笔右侧金额；各笔金额已知时不要填 orderTotal',
      '- 列表中支出金额取绝对值写入 cost',
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
