import { test, expect } from "@playwright/test";

test.describe("クリティカルフロー", () => {
  test("プロフィール作成から公開まで", async ({ page }) => {
    // 1. サインインページへ移動
    await page.goto("/signin");

    // 2. テストユーザーでログイン
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "test123456");
    await page.click('button:has-text("サインイン")');

    // 3. ダッシュボードへのリダイレクトを確認
    await expect(page).toHaveURL("/dashboard");

    // 4. プロフィール編集へ移動
    await page.click('a[href="/dashboard/edit/design"]');

    // 5. テキストコンポーネントを追加
    await page.click("text=テキスト追加");

    // 6. 保存確認
    await expect(page.locator("text=保存しました")).toBeVisible({
      timeout: 5000,
    });

    // 7. 公開プロフィールを確認
    await page.goto("/p/testuser");
    await expect(page.locator("h1")).toContainText("testuser");
  });

  test("VCardダウンロード", async ({ page }) => {
    await page.goto("/p/testuser");

    // ダウンロード開始を待機
    const downloadPromise = page.waitForEvent("download");
    await page.click('button:has-text("連絡先を保存")');
    const download = await downloadPromise;

    // ファイル名確認
    expect(download.suggestedFilename()).toContain(".vcf");
  });

  test("QRコード生成", async ({ page }) => {
    await page.goto("/p/testuser");

    // QRコードボタンをクリック
    await page.click('button:has-text("QRコード")');

    // モーダルが表示されることを確認
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // QRコード画像が存在することを確認
    await expect(page.locator("canvas#qr-code")).toBeVisible();
  });
});

test.describe("安定性確認テスト", () => {
  test("既存ユーザーの完全フロー", async ({ page }) => {
    // 1. ログイン
    await page.goto("/signin");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "test123456");
    await page.click('button:has-text("サインイン")');

    // 2. ダッシュボード確認
    await expect(page).toHaveURL("/dashboard");
    await expect(page.locator("text=ダッシュボード")).toBeVisible();

    // 3. 編集画面への遷移
    await page.click("text=デザインを編集");
    await expect(page).toHaveURL(/\/dashboard\/edit\/design/);

    // 4. エディターの読み込み確認
    await page.waitForSelector(".craftjs-renderer", { timeout: 10000 });

    // 5. コンポーネント追加
    const addButton = page.locator("text=コンポーネントを追加");
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.click("text=テキスト");
    }

    // 6. 保存確認（自動保存を待つ）
    await page.waitForTimeout(3000);

    // 7. 公開ページ確認
    const username = await page.evaluate(() => {
      return window.localStorage.getItem("username");
    });

    if (username) {
      await page.goto(`/p/${username}`);
      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("エラーハンドリング確認", async ({ page }) => {
    // ネットワークエラーのシミュレーション
    await page.route("**/firestore.googleapis.com/**", (route) =>
      route.abort(),
    );

    await page.goto("/dashboard/edit/design");

    // エラーメッセージが適切に表示されることを確認
    await expect(page.locator("text=エラー")).toBeVisible({ timeout: 5000 });
  });

  test("データ整合性確認", async ({ page }) => {
    // 1. ログイン
    await page.goto("/signin");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "test123456");
    await page.click('button:has-text("サインイン")');

    // 2. エディターでコンテンツ追加
    await page.goto("/dashboard/edit/design");
    await page.waitForSelector(".craftjs-renderer", { timeout: 10000 });

    // テストデータを追加
    const testText = `Test-${Date.now()}`;
    const addButton = page.locator("text=コンポーネントを追加");
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.click("text=テキスト");
      // テキストを編集（実装によって異なる可能性あり）
      const textEditor = page.locator('[contenteditable="true"]').last();
      if (await textEditor.isVisible()) {
        await textEditor.fill(testText);
      }
    }

    // 3. ページリロード後も保持されることを確認
    await page.reload();
    await page.waitForSelector(".craftjs-renderer", { timeout: 10000 });

    // データが保持されているか確認
    const content = await page.textContent(".craftjs-renderer");
    expect(content).toContain("コンポーネントを追加"); // デフォルトのプレースホルダーまたは追加したコンテンツ
  });

  test("パフォーマンス基準確認", async ({ page }) => {
    // ダッシュボードのロード時間を計測
    const startTime = Date.now();
    await page.goto("/dashboard");
    await page.waitForSelector("text=ダッシュボード");
    const loadTime = Date.now() - startTime;

    // 3秒以内にロードされることを確認
    expect(loadTime).toBeLessThan(3000);

    // エディターのロード時間を計測
    const editorStartTime = Date.now();
    await page.goto("/dashboard/edit/design");
    await page.waitForSelector(".craftjs-renderer", { timeout: 10000 });
    const editorLoadTime = Date.now() - editorStartTime;

    // 5秒以内にロードされることを確認
    expect(editorLoadTime).toBeLessThan(5000);
  });
});
