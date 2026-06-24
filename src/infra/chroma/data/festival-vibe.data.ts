/** Curated genre / vibe labels for compare cards and RAG catalog snippets. */
export const FESTIVAL_VIBE_BY_CODE: Record<string, string> = {
  storm: '国内大型主流 · House / Bass / 华语电音',
  edc: 'EDC 系 · Bass / House / 多舞台',
  'edc-korea': 'EDC 系 · Bass / House',
  'edc-thailand': 'EDC 系 · Bass / House · 海岛场',
  'edc-orlando': 'EDC 系 · Bass / House · 美式嘉年华',
  tomorrowland: 'Mainstage / Hardstyle / Trance · 童话主题',
  'tomorrowland-belgium': 'Mainstage / Hardstyle / Trance · 比利时原版',
  'tomorrowland-shanghai': '体验展 · Mainstage 风格 · 室内沉浸',
  'ultra-europe': 'Mainstage / Resistance Techno · 欧洲海滨',
  'ultra-japan': 'Mainstage / Resistance · 东京海滨',
  'world-dj-festival': '多舞台主流 · Big Room / Bass',
  defqon1: 'Hardstyle / Hardcore 主场',
  'vac-zhuhai': '国内新锐 · Bass / Hardstyle',
  s2o: 'S2O 泼水音乐节 · Big Room / Bass',
  soundstorm: '中东大型 · Mainstage / Bass',
  'untold-romania': '欧洲大型 · 多曲风',
  'untold-dubai': '中东场 · 多曲风',
  creamfields: 'Creamfields 品牌 · 多曲风',
};

export function getFestivalVibe(code: string): string | undefined {
  return FESTIVAL_VIBE_BY_CODE[code];
}
