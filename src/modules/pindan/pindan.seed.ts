import { PindanType } from '../../database/schemas/pindan.schema';

export const PINDAN_SEED: Array<{
  legacyId: number;
  type: PindanType;
  activityLegacyId: number;
  activityId: string;
  title: string;
  subtitle: string;
  image: string;
  price: number;
  originalPrice: number;
  date: string;
  location: string;
  joined: number;
  total: number;
  tags: string[];
  rating: number;
  includes?: Array<{ kind: 'hotel' | 'transport'; title: string; detail: string }>;
}> = [
  {
    legacyId: 1,
    type: 'package',
    activityLegacyId: 3,
    activityId: 's2o',
    title: '三亚电音节·全程套餐',
    subtitle: 'S2O Festival · 酒店+机票联合拼',
    image:
      'https://images.unsplash.com/photo-1540039155732-d674d4e3f421?w=400&q=80',
    price: 1580,
    originalPrice: 3800,
    date: '06/27-30',
    location: '三亚海棠湾',
    joined: 3,
    total: 4,
    tags: ['酒店+机票', '节省58%', '4晚住宿'],
    rating: 4.9,
    includes: [
      { kind: 'hotel', title: '亚特兰蒂斯海景房', detail: '3晚·含早餐' },
      { kind: 'transport', title: '上海→三亚 商务舱', detail: '06/27 PVG→SYX' },
    ],
  },
  {
    legacyId: 2,
    type: 'package',
    activityLegacyId: 2,
    activityId: 'edc',
    title: 'EDC China·出行套餐',
    subtitle: 'EDC China 2025 · 酒店+专车联合拼',
    image:
      'https://images.unsplash.com/photo-1470229722913-7c090be5c520?w=400&q=80',
    price: 980,
    originalPrice: 2280,
    date: '07/11-14',
    location: '苏州阳澄湖',
    joined: 2,
    total: 4,
    tags: ['酒店+专车', '节省57%', '3晚住宿'],
    rating: 4.8,
    includes: [
      { kind: 'hotel', title: '太湖精品湖景房', detail: '3晚·含双早' },
      { kind: 'transport', title: '上海→苏州 商务MPV', detail: '07/11 虹桥→阳澄湖' },
    ],
  },
  {
    legacyId: 3,
    type: 'package',
    activityLegacyId: 1,
    activityId: 'tomorrowland',
    title: 'Tomorrowland·周末套餐',
    subtitle: '预热派对 · 酒店+机票联合拼',
    image:
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80',
    price: 1280,
    originalPrice: 2900,
    date: '06/19-21',
    location: '上海静安区',
    joined: 5,
    total: 6,
    tags: ['酒店+机票', '节省56%', '2晚住宿'],
    rating: 4.7,
    includes: [
      { kind: 'hotel', title: '外滩景观大床房', detail: '2晚·含早餐' },
      { kind: 'transport', title: '北京→上海 经济舱', detail: '06/19 PEK→PVG' },
    ],
  },
  {
    legacyId: 4,
    type: 'hotel',
    activityLegacyId: 3,
    activityId: 's2o',
    title: '三亚亚特兰蒂斯',
    subtitle: '海景大床房 · 4人均摊节省70%',
    image:
      'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=400&q=80',
    price: 450,
    originalPrice: 1800,
    date: '06/27-30',
    location: '三亚海棠湾',
    joined: 2,
    total: 4,
    tags: ['海景房', '含早餐'],
    rating: 4.9,
  },
  {
    legacyId: 5,
    type: 'hotel',
    activityLegacyId: 2,
    activityId: 'edc',
    title: '阳澄湖精品民宿',
    subtitle: '湖景双床 · 3晚4人均摊',
    image:
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80',
    price: 280,
    originalPrice: 1120,
    date: '07/11-14',
    location: '苏州阳澄湖',
    joined: 3,
    total: 4,
    tags: ['湖景房', '含早餐'],
    rating: 4.8,
  },
  {
    legacyId: 12,
    type: 'transport',
    activityLegacyId: 4,
    activityId: 'ultra',
    title: 'Ultra 接驳专线',
    subtitle: '上海各站点 → 世博公园',
    image:
      'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&q=80',
    price: 120,
    originalPrice: 360,
    date: '08/01-03',
    location: '上海各站点 → 世博公园',
    joined: 3,
    total: 5,
    tags: ['定点接驳', '含行李', '准时发车'],
    rating: 4.7,
  },
];
