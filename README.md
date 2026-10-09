# Albert Stock

美股與台股 AI × 太空 KD 超跌榜，可部署到 GitHub Pages。不含 A 股、不含 K 線圖。

## 這個版本有什麼

- 總覽：四大指數快照，加上美股／台股 AI、太空題材池，依 KD(9,3,3) 超跌排序
- 太空頁：美股發射／衛星通訊／國防太空，台股天線、測試、化合物半導體與高頻材料，並附逐家前景分析
- 美股頁：AI、太空兩張榜；台股頁再加證交所當日量價排行
- 個股頁：台股本益比、殖利率、月營收、近三年營收圖、股利分配；公告／新聞外連；可加入自選
- 自選清單存在瀏覽器 localStorage
- 風控頁：手動輸入台股／美股市值與現金，依指數位階、波動與題材超跌廣度估持股配置；庫存明細可帶入股數重算
- 開啟網站時會即時重抓台股收盤／排行、本益比與加權指數；美股指數與美股題材則補最新報價。月營收歷史仍靠建置檔
- 部署時抓 Yahoo 日K、證交所／櫃買月營收與股利，寫入 `quotes.json`、`theme-boards.json`、`tw-rankings.json`、`tw-fundamentals.json`，並每小時自動再部署一次

K&lt;20 或 D&lt;20 視為嚴格超跌。盤中不採當日未完成 K 棒。資訊僅供參考，不是投資建議。

## 本機執行

```bash
npm install
npm run quotes
npm run dev
```

瀏覽器打開 `http://localhost:5173`。

## 部署到 GitHub Pages

1. 把這個專案推到 GitHub（建議 repo 名稱 `albert-stock`）
2. 進 repo **Settings → Pages**
3. Build and deployment 選 **GitHub Actions**
4. 推上 `main` 後，等 Actions 跑完

網站網址會是：

`https://<你的帳號>.github.io/albert-stock/`

因為用相對路徑與 Hash Router，放在專案網站或自訂網域都可以。
