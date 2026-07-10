# AI 出行攻略 — 高德地图数据链路

出行攻略 **必须** 基于高德地图 Web 服务返回的真实 POI / 路线数据；酒店、停车、夜宵均来自 **周边检索**，不再使用运营维护的酒店清单。

## 能力对照

| 功能 | 高德 API | 代码入口 | 用途 |
|------|----------|----------|------|
| 地理编码 | `GET /v3/geocode/geo` | `AmapMapService.geocode` | 用户输入「福田」→ 坐标 |
| 逆地理编码 | `GET /v3/geocode/regeo` | `AmapMapService.reverseGeocode` | 场馆坐标 → 攻略可读地址 |
| 周边 POI | `GET /v3/place/around` | `AmapMapService.searchNearbyPois` | 酒店 / 停车场 / 夜宵 |
| 输入提示 | `GET /v3/assistant/inputtips` | `AmapMapService.getSuggestion` | 出发地自动补全 |
| 驾车路线 | `GET /v3/direction/driving` | `AmapMapService.drivingRoute` | 自驾路线 |
| 公交路线 | `GET /v3/direction/transit/integrated` | `AmapMapService.transitRoute` | 公共交通 |
| 步行路线 | `GET /v3/direction/walking` | `AmapMapService.walkingRoute` | 步行 |
| 距离测量 | `GET /v3/distance` | `AmapMapService.calculateDistanceToMany` | 多点距离/时长 |

**禁止** 在无地图 POI/路线数据时直接调用大模型生成攻略（已移除 legacy LLM 路径与静态模板兜底）。

所有 Web 服务请求经 `MapApiRateLimiter`（`map-api-rate-limiter.ts`，`AmapMapService.getJson`）限流：

- 默认 **每秒最多 5 次**（`AMAP_QPS`）
- 默认 **最多 5 个并发**（`AMAP_MAX_CONCURRENT`）

## 数据流

```
用户请求 generate
    │
    ├─ 场馆坐标 ──► Hot Path 内存 ──► Mongo travel_guide_venue_cache ──► geocode + regeo (缓存 7 天)
    │
    ├─ 枢纽路线 ──► Hot Path 预计算（机场/高铁站 → 场馆）──► 否则 direction API
    │
    └─ 周边 POI ──► place/around（酒店 3km / 其他 1km，内存缓存 6 小时）
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

数据文件：`src/data/travel-guide/travel-guide-hot-path.data.ts`  
启动时 `TravelGuideVenueCacheSeedService` 同步至 Mongo 集合 `travel_guide_venue_cache`。

### POI 兜底（配额用尽时）

高德 `place/around` 返回空或日配额用尽时，热门活动使用 `src/data/travel-guide/travel-guide-hot-path-pois.data.ts` 内预置停车/夜宵 POI（**不含酒店**，酒店必须来自高德检索或报错）。

### 内存缓存

| 类型 | TTL | Key 示例 |
|------|-----|----------|
| 地理编码 | 7 天 | `geo:深圳` |
| 逆地理编码 | 7 天 | `rev:22.70530,113.93960` |
| POI 搜索结果 | 6 小时 | `poi:4:hotel:酒店` |

## REST

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/activities/:legacyId/travel-guide/generate` | 生成攻略（需登录） |
| GET | `/api/travel-guide/place-suggestions?keyword=&region=` | 出发地输入提示（小程序，高德 + 本地城市库） |
| GET | `/api/raven/place-suggestions?keyword=&limit=` | Raven 出发地：关键词搜城市（+ IATA 直达） |
| GET | `/api/raven/place-suggestions?city=&country=` | Raven 出发地：返回该城市全部机场（选中城市后） |
| POST | `/api/raven/activities/:legacyId/plan/generate` | Raven 生成攻略（无需登录） |
| POST | `/api/raven/activities/:legacyId/plan/generate-async` | Raven 异步生成攻略（无需登录） |
| GET | `/api/raven/plan/generation-jobs/:jobId` | Raven 轮询异步任务（jobId 即凭证） |
| GET | `/api/raven/plans/:guideId` | Raven 只读拉取已保存攻略（guideId 即凭证，无需登录） |

## 配置

```bash
# 高德开放平台 — Web 服务 Key（需开通：地理/逆地理、周边搜索、输入提示、路线规划）
AMAP_KEY=你的Key
# 可选限流
# AMAP_QPS=5
# AMAP_MAX_CONCURRENT=5
```

兼容：未配置 `AMAP_KEY` 时回退读取 `TENCENT_MAP_KEY`（仅过渡期，建议尽快迁移）。

控制台：https://console.amap.com/dev/key/app
