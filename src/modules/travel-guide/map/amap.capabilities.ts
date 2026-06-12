/**
 * 高德地图 Web 服务 API（AI 出行攻略）
 *
 * | 功能       | API 路径                    | 用途 |
 * |------------|-----------------------------|------|
 * | 地理编码   | /v3/geocode/geo             | 出发地 → 坐标 |
 * | 逆地理编码 | /v3/geocode/regeo           | 坐标 → 可读地址 |
 * | 周边搜索   | /v3/place/around            | 酒店 / 停车 / 餐饮 POI |
 * | 输入提示   | /v3/assistant/inputtips     | 出发地自动补全 |
 * | 驾车路线   | /v3/direction/driving       | 自驾路线 |
 * | 公交路线   | /v3/direction/transit/integrated | 公共交通 |
 * | 步行路线   | /v3/direction/walking       | 步行 |
 * | 距离测量   | /v3/distance                | 距离/时长 |
 */
export const AMAP_WS = {
  geocode: '/v3/geocode/geo',
  regeo: '/v3/geocode/regeo',
  placeAround: '/v3/place/around',
  inputTips: '/v3/assistant/inputtips',
  directionDriving: '/v3/direction/driving',
  directionTransit: '/v3/direction/transit/integrated',
  directionWalking: '/v3/direction/walking',
  distance: '/v3/distance',
} as const;
