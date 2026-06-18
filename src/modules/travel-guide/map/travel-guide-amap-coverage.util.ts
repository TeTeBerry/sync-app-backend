/**
 * 高德「周边搜索」主要覆盖中国大陆。境外场馆坐标调用 place/around 常返回错误国内 POI。
 */
export function isVenueOutsideAmapPoiCoverage(
  lat: number,
  lng: number,
): boolean {
  const inMainlandChina =
    lat >= 18.0 && lat <= 54.0 && lng >= 73.0 && lng <= 135.0;
  return !inMainlandChina;
}
