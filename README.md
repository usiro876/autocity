# Auto City

10×10グリッド都市成長シミュレーションのブラウザ実装です。

## 実行方法

静的ファイルを配信できるサーバーで起動します。

```bash
python3 -m http.server 4173
```

その後 `http://localhost:4173` を開いてください。

## 実装済み要素

- 10×10グリッド、建物テンプレート選択、回転、衝突判定
- ポート向き一致による接続
- autoConnect + range による仮想リンク接続
- Union-Find によるクラスター再構築
- 年間ループ（供給フェイズ→レベルアップフェイズ）
- 閾値関数（linear / exponential）
- growthCap（cluster size + hub bonus）
- Year50終了想定のスコア計算
- クラスター色分け、リンク可視化、年間ログ
