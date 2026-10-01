# HK Bus - 香港巴士 ETA 查詢

一個整合九巴（KMB）、城巴（CTB）、新大嶼山巴士（NLB）及綠色專線小巴（GMB）的即時到站查詢工具，支援路線搜尋、站點查詢、收藏書籤等功能。

## 功能

- **路線查詢** - 搜尋全港所有巴士及小巴路線，查看沿途站點
- **站點查詢** - 搜尋巴士站名稱，查看經過該站的所有路線及到站時間
- **即時 ETA** - 顯示各營運商的預計到站時間，每 30 秒自動更新
- **綠色專線小巴** - 專線小巴實時到站資訊，另顯示收費、車程與班距
- **收藏書籤** - 儲存常用路線及站點，一鍵查看
- **離線友善快取** - 路線與站牌資料會暫存在瀏覽器，減少重複請求

## 營運商支援

| 營運商 | 代號 | 路線搜尋 | 站牌 ETA | 車站看板 | 全港車站搜尋 |
| --- | --- | --- | --- | --- | --- |
| 九巴 | KMB | ✓ | ✓ | ✓ | ✓ |
| 城巴 | CTB | ✓ | ✓ | ✓ | — |
| 新大嶼山巴士 | NLB | ✓ | ✓ | — | — |
| 綠色專線小巴 | GMB | ✓ | ✓ | ✓ | — |

- 新大嶼山巴士的 ETA 查詢必須帶上路線代號，無法一次取得整個車站的所有路線，因此沒有車站看板。
- 綠色專線小巴沒有「列出所有小巴站」的端點（`/stop-route` 只能由站號反查），建立全港索引需要逐條路線抓取數百次，因此沒有車站搜尋；請使用路線搜尋。
- 紅色小巴目前沒有任何公開的到站時間 API，故未支援。

## 本地開發

**前置需求:** Node.js

```bash
# 安裝依賴
npm install

# 啟動開發伺服器（含九巴 API proxy）
npm run dev
```

開發伺服器會在 `http://localhost:3000` 啟動。

其他指令：

```bash
npm run typecheck   # TypeScript 型別檢查（strict 模式）
npm run build       # 產生 dist/
npm run clean       # 移除 dist/
npm run preview     # 預覽正式版建置結果
```

## 部署

自動部署至 GitHub Pages（透過 GitHub Actions）。建置前會先跑型別檢查。

## 架構

資料存取分三層，元件不需要知道任何一家 API 的端點細節：

```
src/lib/
  types.ts          正規化領域模型（RouteVariant / Stop / Eta）
  http.ts           fetch 包裝：逾時、重試、取消、ApiError
  cache.ts          記憶體 + localStorage 兩層快取、請求去重
  format.ts         ETA 時間格式化
  bookmarks.ts      收藏與領域模型的轉換
  operators/        各營運商 adapter（KMB / CTB / NLB / GMB）
  api.ts            對外 facade
src/hooks/
  usePolling        統一輪詢（逾時、取消、頁面隱藏暫停、錯誤狀態）
  useStopEtas       路線沿途各站 ETA 的漸進式載入
```

新增營運商只要在 `src/lib/operators/` 加一個 adapter 並註冊到
`operators/index.ts`；徽章顏色、是否支援車站搜尋等能力會自動由 adapter 推導，
不需要改動任何元件。

## 技術棧

- React 19 + TypeScript（strict）
- Vite + Tailwind CSS v4
- Express（開發用九巴 API proxy）
- Zustand（收藏狀態）
- GitHub Pages 部署

## API 來源

| 營運商 | 端點 |
| --- | --- |
| 九巴 | `data.etabus.gov.hk/v1/transport/kmb` |
| 城巴 | `rt.data.gov.hk/v2/transport/citybus` |
| 新大嶼山巴士 | `rt.data.gov.hk/v2/transport/nlb` |
| 綠色專線小巴 | `data.etagmb.gov.hk`（運輸署實時到站資訊系統） |
| 小巴路線及收費索引 | `static.data.gov.hk/td/routes-fares-xml/ROUTE_GMB.xml` |

註：綠色小巴 API 會拒絕沒有 `User-Agent` 的請求。瀏覽器自動帶 UA，
若日後要為它在 `server.ts` 加 proxy，需自行設定該標頭。
