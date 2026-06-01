/**
 * 腾讯位置服务 WebService 能力与路径对照（AI 出行攻略）
 *
 * | 功能       | API 路径 / 服务           | 用途 |
 * |------------|---------------------------|------|
 * | 地理编码   | /ws/geocoder/v1/          | 出发地「福田」→ 坐标，路线规划 |
 * | 逆地理编码 | /ws/geocoder/v1/?location= | 场馆坐标 → 可读地址（攻略文案） |
 * | 地点搜索   | /ws/place/v1/search       | 场馆附近酒店 / 餐饮 / 停车场 POI |
 * | 输入提示   | /ws/place/v1/suggestion   | 出发城市、场馆名自动补全 |
 * | 路线规划   | /ws/direction/v1/{mode}/  | driving / transit / walking |
 * | 距离计算   | /ws/distance/v1/          | 单起点到多终点距离/时长矩阵 |
 */
export const TENCENT_MAP_WS = {
  geocoder: '/geocoder/v1/',
  placeSearch: '/place/v1/search',
  placeSuggestion: '/place/v1/suggestion',
  directionDriving: '/direction/v1/driving/',
  directionTransit: '/direction/v1/transit/',
  directionWalking: '/direction/v1/walking/',
  distance: '/distance/v1/',
} as const;
