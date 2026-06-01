# AI 出行攻略 · 腾讯地图接入说明

## 能力对照

| 功能 | 腾讯 API | 代码入口 | 用途 |
|------|----------|----------|------|
| 地理编码 | `GET /ws/geocoder/v1/?address=` | `TencentMapService.geocode` | 用户输入「福田」→ 坐标 |
| 逆地理编码 | `GET /ws/geocoder/v1/?location=lat,lng` | `TencentMapService.reverseGeocode` | 场馆坐标 → 攻略可读地址 |
| 地点搜索 POI | `GET /ws/place/v1/search` | `TencentMapService.searchNearbyPois` | 酒店 / 停车场 / 夜宵 / 酒吧 |
| 输入提示 | `GET /ws/place/v1/suggestion` | `TencentMapService.getSuggestion` | 出发地自动补全 |

**出发地补全单源**：`GET /api/travel-guide/place-suggestions?keyword=&region=`（`TravelGuideMapController`）。城市库、锚点、本地+远程合并均在 `travel-guide-departure-suggestions.util.ts`；前端只消费 API，勿维护 `travelGuideCities`。
| 路线规划 | `GET /ws/direction/v1/{driving\|transit\|walking}/` | `drivingRoute` / `transitRoute` / `walkingRoute` | 出发地 → 场馆 |
| 距离计算 | `GET /ws/distance/v1/` | `TencentMapService.calculateDistanceToMany` | 多点距离/时长 |

详见 `src/modules/travel-guide/map/tencent-map.capabilities.ts`。

## 调用策略（避免每次全量打 API）

**禁止**在无腾讯地图 POI/路线数据时直接调用大模型生成攻略（已移除 legacy LLM 路径与静态模板兜底）。

```
用户请求 generate
    │
    ├─ 场馆坐标 ──► Hot Path 内存 ──► Mongo travel_guide_venue_cache ──► geocoder + reverseGeocoder (缓存 7 天)
    │
    ├─ 枢纽路线 ──► Hot Path 预计算（机场/高铁站 → 场馆）──► 否则 direction API
    │
    └─ 周边 POI ──► place/search（按活动+关键词内存缓存 6 小时）
            │
            ▼
        Ranker 筛选排序
            │
            ├─►（可选）LLM 仅润色 candidates 文案
            │
            └─► 失败则 mapCandidatesToLlmFallback（仍来自地图真实店名）
```

### Hot Path（已内置）

| activityLegacyId | 活动 | 预置内容 |
|------------------|------|----------|
| 4 | 风暴电音节 深圳站 | 深圳国际会展中心坐标、宝安机场/深圳北站/广州南站 → 场馆驾车路线 |
| 2 | EDC China | 阳澄湖半岛、苏州北站/硕放机场路线 |
| 5 | EDC Thailand | Rhythm Park、普吉机场路线 |

数据文件：`map/travel-guide-hot-path.data.ts`  
启动时 `TravelGuideVenueCacheSeedService` 同步至 Mongo 集合 `travel_guide_venue_cache`。

### POI 兜底（配额用尽时）

腾讯地图 `place/search` 返回空或 **status 121（日配额用尽）** 时，热门活动使用 `travel-guide-hot-path-pois.data.ts` 内预置酒店/停车/夜宵 POI，保证攻略仍可生成（文案会标注地图检索降级）。

### 内存缓存

| 类型 | TTL | Key 示例 |
|------|-----|----------|
| 地理编码 | 7 天 | `geo:深圳` |
| 逆地理编码 | 7 天 | `rev:22.70530,113.93960` |
| POI 搜索结果 | 6 小时 | `poi:4:hotel:酒店` |

## REST

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/activities/:legacyId/travel-guide/generate` | 生成攻略（需登录/demo） |
| GET | `/api/travel-guide/place-suggestions?keyword=&region=` | 出发地输入提示（Public） |

## 配置

```bash
TENCENT_MAP_KEY=你的Key
```

未配置 Key 时：`generate` 返回 503；出发地补全接口仍可用本地城市库兜底。
