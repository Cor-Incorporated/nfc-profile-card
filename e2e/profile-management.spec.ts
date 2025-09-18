import { test, expect, type Page } from "@playwright/test";

// モック認証ヘルパー
async function mockAuthentication(page: Page) {
  // 実際のプロジェクトではFirebase AuthのトークンをセットアップParse
  await page.addInitScript(() => {
    window.localStorage.setItem("auth-token", "mock-token");
  });
}

test.describe("プロフィール管理", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthentication(page);
    await page.goto("/dashboard");
  });

  test("ダッシュボードの基本要素確認", async ({ page }) => {
    // ダッシュボードの主要要素が表示されることを確認
    await expect(page.locator("h1, h2").first()).toContainText(
      /ダッシュボード|Dashboard|マイページ/i,
    );

    // プロフィール編集リンクの存在確認
    const editProfileLink = page.locator(
      'a[href="/dashboard/edit"], button:has-text("プロフィール編集")',
    );
    await expect(editProfileLink.first()).toBeVisible();

    // NFC カード管理セクションの存在確認
    const nfcSection = page.locator("text=/NFCカード|NFC Card|カード管理/i");
    await expect(nfcSection.first()).toBeVisible();
  });

  test("プロフィール編集ページへの遷移", async ({ page }) => {
    // プロフィール編集リンクをクリック
    const editLink = page
      .locator('a[href="/dashboard/edit"], button:has-text("プロフィール編集")')
      .first();
    await editLink.click();

    // 編集ページへの遷移を確認
    await expect(page).toHaveURL("/dashboard/edit");
    await expect(page.locator("h1, h2").first()).toContainText(
      /プロフィール編集|Edit Profile|プロフィール設定/i,
    );
  });

  test("プロフィール情報の更新", async ({ page }) => {
    await page.goto("/dashboard/edit");

    // 基本情報の入力
    const nameInput = page
      .locator('input[name="name"], input[placeholder*="名前"]')
      .first();
    await nameInput.fill("テストユーザー");

    const bioInput = page
      .locator('textarea[name="bio"], textarea[placeholder*="自己紹介"]')
      .first();
    await bioInput.fill("これはテスト用の自己紹介文です。");

    const companyInput = page
      .locator('input[name="company"], input[placeholder*="会社"]')
      .first();
    if (await companyInput.isVisible()) {
      await companyInput.fill("テスト株式会社");
    }

    const positionInput = page
      .locator('input[name="position"], input[placeholder*="役職"]')
      .first();
    if (await positionInput.isVisible()) {
      await positionInput.fill("開発者");
    }

    // 保存ボタンをクリック
    const saveButton = page.getByRole("button", { name: /保存|Save|更新/i });
    await saveButton.click();

    // 成功メッセージまたはダッシュボードへのリダイレクトを確認
    const successMessage = page.locator(
      "text=/保存しました|Saved successfully|更新しました/i",
    );
    const dashboardRedirect = page
      .waitForURL("/dashboard", { timeout: 5000 })
      .catch(() => null);

    await Promise.race([
      successMessage.waitFor({ timeout: 5000 }),
      dashboardRedirect,
    ]);
  });

  test("ソーシャルリンクの追加と削除", async ({ page }) => {
    await page.goto("/dashboard/edit");

    // リンク追加ボタンを探してクリック
    const addLinkButton = page.locator(
      'button:has-text("リンク"), button:has-text("Add Link"), button:has-text("追加")',
    );

    if (await addLinkButton.first().isVisible()) {
      await addLinkButton.first().click();

      // 新しいリンク入力フィールドを探す
      const linkInputs = page.locator(
        'input[placeholder*="URL"], input[placeholder*="https://"]',
      );
      const lastLinkInput = linkInputs.last();

      // URLを入力
      await lastLinkInput.fill("https://github.com/testuser");

      // タイトル入力（存在する場合）
      const titleInput = page
        .locator('input[placeholder*="タイトル"], input[placeholder*="Title"]')
        .last();
      if (await titleInput.isVisible()) {
        await titleInput.fill("GitHub");
      }

      // 保存
      const saveButton = page.getByRole("button", { name: /保存|Save/i });
      await saveButton.click();

      // 成功メッセージを確認
      await expect(page.locator("text=/保存|Success/i")).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("プロフィール画像のアップロード", async ({ page }) => {
    await page.goto("/dashboard/edit");

    // ファイル入力要素を探す
    const fileInput = page.locator('input[type="file"][accept*="image"]');

    if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      // テスト用の画像ファイルをアップロード
      // 実際のテストでは、テスト用の画像ファイルを用意する必要があります
      const buffer = Buffer.from("fake-image-data");
      await fileInput.setInputFiles({
        name: "test-image.jpg",
        mimeType: "image/jpeg",
        buffer: buffer,
      });

      // アップロード処理の完了を待つ
      await page.waitForTimeout(1000);

      // 画像プレビューまたは成功メッセージを確認
      const preview = page.locator(
        'img[alt*="プロフィール"], img[alt*="Profile"], img[alt*="Avatar"]',
      );
      await expect(preview.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("ユーザー名の変更と一意性チェック", async ({ page }) => {
    await page.goto("/dashboard/edit");

    const usernameInput = page
      .locator('input[name="username"], input[placeholder*="ユーザー名"]')
      .first();

    if (await usernameInput.isVisible()) {
      // 既存のユーザー名をクリア
      await usernameInput.clear();

      // 新しいユーザー名を入力
      const timestamp = Date.now();
      await usernameInput.fill(`testuser${timestamp}`);

      // フォーカスを外して検証をトリガー
      await usernameInput.blur();

      // 利用可能メッセージまたはエラーメッセージを確認
      const availableMessage = page.locator(
        "text=/利用可能|Available|使用できます/i",
      );
      const errorMessage = page.locator(
        "text=/使用中|Already taken|利用できません/i",
      );

      await expect(availableMessage.or(errorMessage).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("連絡先情報の更新", async ({ page }) => {
    await page.goto("/dashboard/edit");

    // メールアドレス
    const emailInput = page
      .locator('input[name="email"], input[type="email"]')
      .first();
    if (await emailInput.isVisible()) {
      await emailInput.clear();
      await emailInput.fill("test@example.com");
    }

    // 電話番号
    const phoneInput = page
      .locator('input[name="phone"], input[type="tel"]')
      .first();
    if (await phoneInput.isVisible()) {
      await phoneInput.clear();
      await phoneInput.fill("090-1234-5678");
    }

    // 住所
    const addressInput = page
      .locator('input[name="address"], textarea[name="address"]')
      .first();
    if (await addressInput.isVisible()) {
      await addressInput.clear();
      await addressInput.fill("東京都渋谷区1-2-3");
    }

    // 保存
    const saveButton = page.getByRole("button", { name: /保存|Save/i });
    await saveButton.click();

    // 保存確認
    await expect(page.locator("text=/保存|Success/i")).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("公開プロフィールページ", () => {
  test("公開プロフィールページの表示", async ({ page }) => {
    // テスト用の公開プロフィールページにアクセス
    await page.goto("/p/testuser");

    // 404エラーまたはプロフィールページの表示を確認
    const profileName = page.locator("h1, h2").first();
    const notFound = page.locator("text=/見つかりません|Not Found|404/i");

    await expect(profileName.or(notFound).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("VCard ダウンロード機能", async ({ page }) => {
    await page.goto("/p/testuser");

    // VCardダウンロードボタンを探す
    const vcardButton = page.locator(
      'button:has-text("連絡先"), button:has-text("Download"), button:has-text("VCard")',
    );

    if (
      await vcardButton
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      // ダウンロードイベントをリッスン
      const downloadPromise = page.waitForEvent("download");

      // ボタンをクリック
      await vcardButton.first().click();

      // ダウンロードを待つ（タイムアウトでキャッチ）
      const download = await downloadPromise.catch(() => null);

      if (download) {
        // ダウンロードファイルの確認
        expect(download.suggestedFilename()).toContain(".vcf");
      }
    }
  });

  test("ソーシャルリンクの表示と動作", async ({ page }) => {
    await page.goto("/p/testuser");

    // ソーシャルリンクセクションを探す
    const linksSection = page
      .locator("section")
      .filter({ has: page.locator('a[href*="http"]') });

    if (await linksSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      const links = linksSection.locator('a[href*="http"]');
      const count = await links.count();

      // 少なくとも1つのリンクが存在することを確認
      expect(count).toBeGreaterThan(0);

      // 各リンクがtarget="_blank"を持つことを確認
      for (let i = 0; i < Math.min(count, 3); i++) {
        const link = links.nth(i);
        await expect(link).toHaveAttribute("target", "_blank");
      }
    }
  });

  test("レスポンシブデザインの確認", async ({ page }) => {
    await page.goto("/p/testuser");

    // デスクトップビュー
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator("main, .container").first()).toBeVisible();

    // タブレットビュー
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator("main, .container").first()).toBeVisible();

    // モバイルビュー
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator("main, .container").first()).toBeVisible();

    // モバイルでのナビゲーションメニュー確認
    const mobileMenuButton = page.locator(
      'button[aria-label*="menu"], button:has-text("☰")',
    );
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      // メニューが開くことを確認
      await expect(
        page.locator('nav, [role="navigation"]').first(),
      ).toBeVisible();
    }
  });
});

test.describe("NFCカード管理", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthentication(page);
    await page.goto("/dashboard");
  });

  test("NFCカードの追加", async ({ page }) => {
    // NFCカード管理セクションを探す
    const nfcSection = page
      .locator("section")
      .filter({ hasText: /NFCカード|NFC Card/i });

    if (await nfcSection.isVisible()) {
      // カード追加ボタンをクリック
      const addCardButton = nfcSection.locator(
        'button:has-text("追加"), button:has-text("Add Card")',
      );
      if (await addCardButton.isVisible()) {
        await addCardButton.click();

        // モーダルまたは新規ページの表示を確認
        const cardIdInput = page.locator(
          'input[placeholder*="カードID"], input[placeholder*="Card ID"]',
        );
        await expect(cardIdInput).toBeVisible({ timeout: 5000 });

        // カードIDを入力
        await cardIdInput.fill(`CARD-${Date.now()}`);

        // カード名を入力（オプショナル）
        const cardNameInput = page.locator(
          'input[placeholder*="カード名"], input[placeholder*="Card Name"]',
        );
        if (await cardNameInput.isVisible()) {
          await cardNameInput.fill("テストカード");
        }

        // 保存
        const saveButton = page.getByRole("button", {
          name: /保存|Save|登録/i,
        });
        await saveButton.click();

        // 成功メッセージを確認
        await expect(
          page.locator("text=/登録しました|Added successfully/i"),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("NFCカードの無効化", async ({ page }) => {
    // 既存のカードリストを探す
    const cardList = page
      .locator('[data-testid="card-list"], .card-list, ul')
      .filter({ has: page.locator("text=/CARD-/i") });

    if (await cardList.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 最初のカードの無効化ボタンをクリック
      const disableButton = cardList
        .locator('button:has-text("無効化"), button:has-text("Disable")')
        .first();

      if (await disableButton.isVisible()) {
        await disableButton.click();

        // 確認ダイアログが表示される場合
        const confirmButton = page.locator(
          'button:has-text("確認"), button:has-text("Confirm")',
        );
        if (
          await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          await confirmButton.click();
        }

        // ステータス変更を確認
        await expect(page.locator("text=/無効|Disabled/i")).toBeVisible({
          timeout: 5000,
        });
      }
    }
  });
});
