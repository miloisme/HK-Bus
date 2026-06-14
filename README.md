# HK Bus - 香港巴士 ETA 查詢

一個整合九巴（KMB）、城巴（CTB）及新大嶼山巴士（NLB）的即時到站查詢工具，支援路線搜尋、站點查詢、收藏書籤等功能。

## 功能

- **路線查詢** - 搜尋全港所有巴士路線，查看沿途站點
- **站點查詢** - 直接搜尋巴士站名稱，查看經過該站的所有路線及到站時間
- **即時 ETA** - 顯示各巴士公司的預計到站時間
- **收藏書籤** - 儲存常用路線及站點，一鍵查看
- **雙語支援** - 繁體中文為主要語言

## 本地開發

**前置需求:** Node.js

```bash
# 安裝依賴
npm install

# 啟動開發伺服器（含 KMB API proxy）
npm run dev
```

開發伺服器會在 `http://localhost:3000` 啟動。

## 部署

自動部署至 GitHub Pages（透過 GitHub Actions）：

```bash
npm run build
```

產生的靜態檔案位於 `dist/` 目錄。

## 技術棧

- React 19 + TypeScript
- Vite + Tailwind CSS v4
- Express（開發用 API proxy）
- Zustand（狀態管理）
- GitHub Pages 部署

## API 來源

- 九巴：`data.etabus.gov.hk`
- 城巴：`rt.data.gov.hk`
- 新大嶼山巴士：`rt.data.gov.hk`
