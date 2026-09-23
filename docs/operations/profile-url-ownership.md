# 公開プロフィール URL の所有確認と旧 URL の移行

公開 URL は `usernames/{小文字名}` の予約、`usernameAliases/{小文字名}` の旧名記録、または `users/{uid}` の正確な `u_<uid>` パスで判定する。`users.username` と `previousUsernames` は過去にクライアントから書き換え可能だったため、それだけでは旧名の再有効化を許可しない。

## 回転時の扱い

- 旧 URL の予約または別名が本人のもので、公開 resolver も本人を返す場合は、要求に応じて新 URL へ転送するか、`status: disabled` の所有記録を残す。
- 予約も別名もない旧 URL が現在本人を一意に表示している場合、無効化時に `uid: null, status: disabled, quarantined: true` の隔離記録を残す。これで URL の再取得と旧本文の表示を止めるが、本人への所有権は付与しない。この旧 URL の転送は拒否する。
- 予約や別名が別 UID を指す場合、競合する記録を上書きしない。本人の予約を削除すると別 UID の別名が露出する組み合わせでは、回転自体を拒否する。
- UID の正確な `u_<uid>` パスは UID 文書が存在する限り解決できる。`disable` でこの固定パス自体を削除することはできない。大文字小文字を変えた UID パスは、別 UID が過去に同じ固定パスを持っていた可能性を排除できないため 404 にする。

## 本番移行の確認

適用前に `users.username` を小文字化した単位で集計し、`usernames` と `usernameAliases` の UID、状態、転送先を突合する。大文字小文字違いの legacy 名、複数ユーザーの同名、本人の予約がない転送先、別 UID を指す競合を監査対象にする。値の一覧を公開ログへ出さない。

集計には `scripts/audit-profile-ownership.cjs` を使う。合成 fixture は `node scripts/audit-profile-ownership.cjs --fixture scripts/fixtures/profile-ownership-audit.json` と `node scripts/audit-profile-ownership.cjs --fixture scripts/fixtures/profile-ownership-audit-false-green.json` で検証する。実環境の担当者は、既存の ADC 権限を確認してから `node scripts/audit-profile-ownership.cjs --live nfc-profile-card --acknowledge-read-cost` を実行する。CLI は `users`、`usernames`、`usernameAliases` の必要フィールドだけを読み、IDや値を出力せず件数だけを標準出力へ返す。終了コードは合格 `0`、競合あり `2`、不完全な監査 `1`、引数誤り `64`。`ownerlessQuarantines` だけを参考件数とし、その他の件数がすべて `0` であることを配信条件にする。大文字の記録 ID、孤立・旧名の予約、UID 固定パスを遮る別名、所有未確認の履歴も配信を止める。

本番適用のゲートは次のとおり。

1. `#119` の後、新規ログインが正確な `u_<uid>` を作る互換アプリ版 X を先に配信する。対象 SHA と alias を確認し、新規ログインを実 UI で試す。resolver を含む `#121` はこの段階では配信しない。
2. `users/{uid}.username` と `previousUsernames` のクライアント変更を拒否する rules 版 Y を配信し、認証済みクライアントの更新拒否を rules リリース番号に結び付けて確認する。旧タブに残った古い JavaScript は保存を拒否され得るため、再読込案内を用意する。
3. rules 版 Y の後、CLI で全件集計する。複数 UID の同じ小文字キー、未予約 legacy、無効な転送先など、参考件数以外のすべてを `0` にする。隔離記録を本人名義へ一括変換しない。`0` を確認するまで resolver を含む `#121` を本番配信しない。
4. resolver 配信後、対象 SHA の preview と本番で正規 URL・転送・無効化・大小文字衝突・削除 UID の URL をそれぞれ確認し、別 UID のプロフィールが表示されないことを記録する。旧 NFC/QR の主要な URL も確認する。

隔離記録を解除する際は、過去の公開 URL と所有 UID の証拠を別途確認し、Admin SDK で予約または別名を移行する。`previousUsernames` の記載だけで解除しない。予約と別名が競合する URL、転送先を証明できない既存 alias、大小文字の legacy 競合は移行まで 404 になる可能性がある。

リリース後は代表的な正規 URL、転送 URL、隔離 URL、大小文字違いの URL を実 HTTP で確認する。テストと CI の成功は本番データの移行完了を意味しない。
