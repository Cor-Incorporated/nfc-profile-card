# 公開プロフィール URL の所有確認と旧 URL の移行

公開 URL は `usernames/{小文字名}` の予約、`usernameAliases/{小文字名}` の旧名記録、または `users/{uid}` の正確な `u_<uid>` パスで判定する。`users.username` と `previousUsernames` は過去にクライアントから書き換え可能だったため、それだけでは旧名の再有効化を許可しない。

## 回転時の扱い

- 旧 URL の予約または別名が本人のもので、公開 resolver も本人を返す場合は、要求に応じて新 URL へ転送するか、`status: disabled` の所有記録を残す。
- 予約も別名もない旧 URL が現在本人を一意に表示している場合、無効化時に `uid: null, status: disabled, quarantined: true` の隔離記録を残す。これで URL の再取得と旧本文の表示を止めるが、本人への所有権は付与しない。この旧 URL の転送は拒否する。
- 予約や別名が別 UID を指す場合、競合する記録を上書きしない。本人の予約を削除すると別 UID の別名が露出する組み合わせでは、回転自体を拒否する。
- UID の正確な `u_<uid>` パスは UID 文書が存在する限り解決できる。`disable` でこの固定パス自体を削除することはできない。大文字小文字を変えた UID パスは、別 UID が過去に同じ固定パスを持っていた可能性を排除できないため 404 にする。

## 本番移行の確認

適用前に `users.username` を小文字化した単位で集計し、`usernames` と `usernameAliases` の UID、状態、転送先を突合する。大文字小文字違いの legacy 名、複数ユーザーの同名、本人の予約がない転送先、別 UID を指す競合を監査対象にする。値の一覧を公開ログへ出さない。

集計には `scripts/audit-profile-ownership.cjs` を使う。合成 fixture は `node scripts/audit-profile-ownership.cjs --fixture scripts/fixtures/profile-ownership-audit.json` で検証する。実環境の担当者は、既存の ADC 権限を確認してから `node scripts/audit-profile-ownership.cjs --live nfc-profile-card --acknowledge-read-cost` を実行する。CLI は `users`、`usernames`、`usernameAliases` の必要フィールドだけを読み、IDや値を出力せず件数だけを標準出力へ返す。終了コードは合格 `0`、競合あり `2`、不完全な監査 `1`、引数誤り `64`。`uidCasefoldReservations`、`ownerlessQuarantines`、`unverifiedHistoryEntries` は移行判断用の参考件数で、それ以外の件数はすべて `0` が配信条件となる。

本番適用のゲートは次のとおり。

1. アプリ配信**前**に CLI の全件集計を実行し、配信条件となる件数がすべて `0` であることを記録する。特に複数 UID が同じ小文字キーを持つ件数、予約と異なる UID の raw exact legacy 件数、予約のない現行 legacy 件数を確認する。件数が残る間は、resolver を含むアプリ版を本番配信しない。
2. `usernameAliases` の転送先が同 UID の予約または正確な UID 固定パスで解決できることを全件確認し、無効な既存転送の件数と移行結果を残す。隔離記録を本人名義へ一括変換しない。
3. 新規ログインのクライアント作成処理が正確な `u_<uid>` を使うアプリ版を配信し、対象 SHA と配信 alias を確認して新規ログインを実 UI で試す。その直後に `users/{uid}.username` と `previousUsernames` のクライアント変更を拒否する Firestore rules を配信し、認証済みクライアントの更新拒否を rules リリース番号に結び付けて確認する。旧 rules のままの時間を短くし、rules 配信直後に手順1の集計を再実施する。新たな所有競合が出たらリリースを停止し、移行またはアプリの巻き戻しを判断する。旧タブに残った古い JavaScript は rules 更新後に保存が拒否され得るため、再読込案内を用意する。
4. 対象 SHA の preview と本番で、正規 URL・転送・無効化・大小文字衝突・削除 UID の URL をそれぞれ確認し、別 UID のプロフィールが表示されないことを記録する。旧 NFC/QR の主要な URL も確認する。

隔離記録を解除する際は、過去の公開 URL と所有 UID の証拠を別途確認し、Admin SDK で予約または別名を移行する。`previousUsernames` の記載だけで解除しない。予約と別名が競合する URL、転送先を証明できない既存 alias、大小文字の legacy 競合は移行まで 404 になる可能性がある。

リリース後は代表的な正規 URL、転送 URL、隔離 URL、大小文字違いの URL を実 HTTP で確認する。テストと CI の成功は本番データの移行完了を意味しない。
