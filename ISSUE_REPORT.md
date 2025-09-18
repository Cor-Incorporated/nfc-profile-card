# 🚨 実装問題レポート - VCard/QRコード機能

## 問題概要
プロフィールページ（`/p/[username]`）において、VCardダウンロードとQRコード生成機能に重大な問題が発生しています。

## 現在の問題

### 1. VCardボタンが表示されない
**状況**: CraftRenderer使用時、ProfileInfoコンポーネント内のVCard保存ボタンが表示されない
**原因**:
- 編集時の`ProfileInfo`コンポーネントにはVCard機能が実装されている
- しかし、表示時の`ReadOnlyProfileInfo`コンポーネントにはVCard機能が実装されていない
- CraftRendererは`ReadOnlyProfileInfo`を使用するため、VCard機能が利用できない

### 2. QRコードモーダルのDOM操作エラー
**エラー**: `NotFoundError: Failed to execute 'removeChild' on 'Node'`
**原因**: qr-code-stylingライブラリが直接DOM操作を行うため、Reactの仮想DOMと競合している

### 3. データの不整合
**問題**: VCardとユーザープロフィールのデータソースが異なる
- ProfileInfo内: エディタで設定した固定データ（山田太郎）
- 外部VCardButton: Firestoreから取得した実データ（寺田康佑）

## アーキテクチャの問題点

```
現在の構造:
┌─────────────────────────────────┐
│ /p/[username]/page.tsx          │
├─────────────────────────────────┤
│ CraftRenderer使用時:             │
│ ├─ CraftRenderer                 │
│ │  └─ ReadOnlyProfileInfo ❌    │ ← VCard機能なし
│ └─ QRCodeModal ⚠️               │ ← DOM操作エラー
├─────────────────────────────────┤
│ 通常テンプレート使用時:          │
│ ├─ VCardButton ✓                │
│ └─ QRCodeModal ⚠️               │
└─────────────────────────────────┘
```

## 推奨される解決策

### 短期的解決策（即時対応）

1. **ReadOnlyProfileInfoにVCard機能を追加**
   - ProfileInfoと同様のVCard生成ロジックを実装
   - 表示用に最適化されたUIを提供

2. **QRコードライブラリの変更**
   - React互換のQRコードライブラリ（react-qr-code等）に変更
   - または、サーバーサイドでQRコード画像を生成

### 長期的解決策（アーキテクチャ改善）

1. **データソースの統一**
   - 全てのコンポーネントが同一のデータソースを参照
   - Context APIまたはpropsでデータを共有

2. **コンポーネントの責任分離**
   - VCard/QR機能を独立したコンポーネントとして切り出し
   - CraftRendererの外部に配置して管理

## 影響範囲

- **ユーザー体験**: プロフィール共有の主要機能が使用不可
- **ビジネス影響**: NFCカード連携の価値提供が不完全
- **技術的負債**: DOM操作エラーによるアプリケーションの不安定性

## 対応優先度

**Critical** - 主要機能が動作しないため、即座の対応が必要

## 推奨アクション

1. ReadOnlyProfileInfoへのVCard機能追加（推定工数: 2時間）
2. QRコードライブラリの置き換え（推定工数: 3時間）
3. データフローの整理とテスト（推定工数: 2時間）

---

作成日: 2025-09-19
報告者: Claude Code