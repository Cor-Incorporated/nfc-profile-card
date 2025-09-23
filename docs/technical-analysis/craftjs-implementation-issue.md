# CraftJS実装問題 - 技術分析レポート

## 問題の核心

### 発見された根本原因

**AddComponentPlaceholderはCraftJS要素ではなく、ツールコンポーネントである**

```typescript
// 正しくない実装（現在）
<Frame>
  <Element is={AddComponentPlaceholder} />  // ❌ AddComponentPlaceholderには.craft設定がない
</Frame>

// 正しい実装
<Frame>
  <Element is="div" canvas />
</Frame>
<AddComponentPlaceholder />  // ✅ Frame外でツールとして機能
```

## CraftJS要素の要件

CraftJS内でElementとして使用するには、以下が必要：

1. **`.craft`設定の実装**

```typescript
ComponentName.craft = {
  displayName: "表示名",
  props: {
    /* デフォルトプロパティ */
  },
  related: {
    settings: SettingsComponent,
  },
};
```

2. **useNodeフックの使用**

```typescript
const {
  connectors: { connect, drag },
} = useNode();
```

3. **適切な参照の設定**

```typescript
ref={(ref) => connect(drag(ref))}
```

## AddComponentPlaceholderの正しい役割

AddComponentPlaceholderは：

- ✅ コンポーネントを追加するためのツール
- ✅ `connectors.create()`を使用してコンポーネントを生成
- ❌ それ自体がCraftJS要素になるべきではない

## 現在の実装の問題点

1. **AddComponentPlaceholderをElementとして配置**
   - `.craft`設定がないため、CraftJSが正しく処理できない
   - 結果：表示されない

2. **resolverへの登録**
   - CraftJS要素ではないコンポーネントを登録
   - 結果：デシリアライズ時にエラー

## 正しい実装アプローチ

### オプション1: Frame外配置（推奨）

```typescript
// PageEditor.tsx
<div className="editor-container">
  {/* ツールバー領域 */}
  {!isPreview && (
    <AddComponentPlaceholder
      socialLinks={socialLinks}
      onSocialLinksChange={setSocialLinks}
    />
  )}

  {/* エディタキャンバス */}
  <Frame>
    <Element is="div" canvas>
      {/* ここに追加されたコンポーネントが配置される */}
    </Element>
  </Frame>
</div>
```

### オプション2: 初期プレースホルダーとして実装

Frame内に最初から配置したい場合は、専用のプレースホルダーコンポーネントを作成：

```typescript
// InitialPlaceholder.tsx
const InitialPlaceholder = () => {
  const { query } = useEditor();
  const { connectors: { connect } } = useNode();

  // ノードが1つ（ROOT）のみの場合に表示
  if (Object.keys(query.getNodes()).length > 1) {
    return null;
  }

  return (
    <div ref={connect} className="initial-placeholder">
      ここにコンポーネントをドラッグ
    </div>
  );
};

InitialPlaceholder.craft = {
  displayName: "初期プレースホルダー",
  props: {}
};
```

## 修正計画

### Phase 1: 即座の修正

1. AddComponentPlaceholderをFrame外に戻す
2. resolverからAddComponentPlaceholderを削除
3. validateAndCleanDataからAddComponentPlaceholder削除ロジックを削除

### Phase 2: 安定化

1. 動作確認
2. データ保存・読み込みの確認
3. ドラッグ&ドロップの動作確認

### Phase 3: 改善

1. より良いUXのための配置検討
2. モバイル対応の最適化

## 教訓

1. **CraftJSの仕様理解**
   - すべてのコンポーネントがCraftJS要素になるわけではない
   - ツールとコンテンツを明確に分離

2. **段階的な修正の危険性**
   - 部分的な修正が問題を複雑化
   - 根本原因の理解なしに修正を重ねない

3. **テストの重要性**
   - 各修正後の完全な動作確認
   - データの実態確認

## 結論

AddComponentPlaceholderはCraftJS要素ではなく、ツールコンポーネントとして実装すべきです。Frame外に配置し、`connectors.create()`を通じてコンポーネントを追加する現在の基本設計は正しいが、実装位置が誤っていました。
