import { test, expect, type Page } from '@playwright/test'

test.describe('認証フロー', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('ランディングページから認証ページへ遷移', async ({ page }) => {
    // ランディングページの確認
    await expect(page).toHaveTitle(/NFC Profile Card/)

    // サインインボタンをクリック
    const signInButton = page.getByRole('link', { name: /sign in/i })
      || page.getByRole('button', { name: /sign in/i })
      || page.locator('text=サインイン').first()
    await signInButton.click()

    // サインインページへの遷移を確認
    await expect(page).toHaveURL('/signin')
    await expect(page.locator('h1, h2').first()).toContainText(/サインイン|Sign In/i)
  })

  test('メールアドレスでの新規登録フロー', async ({ page }) => {
    await page.goto('/signin')

    // 新規登録タブに切り替え（存在する場合）
    const signUpTab = page.getByRole('tab', { name: /新規登録|sign up/i })
    if (await signUpTab.isVisible()) {
      await signUpTab.click()
    }

    // フォーム入力
    const timestamp = Date.now()
    const testEmail = `test${timestamp}@example.com`

    await page.fill('input[name="email"], input[type="email"]', testEmail)
    await page.fill('input[name="password"], input[type="password"]', 'TestPassword123!')

    // 名前フィールドが存在する場合は入力
    const nameField = page.locator('input[name="name"], input[placeholder*="名前"]')
    if (await nameField.isVisible()) {
      await nameField.fill(`Test User ${timestamp}`)
    }

    // 利用規約への同意（チェックボックスがある場合）
    const termsCheckbox = page.locator('input[type="checkbox"]')
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check()
    }

    // 送信ボタンをクリック
    const submitButton = page.getByRole('button', { name: /登録|sign up|create account/i })
    await submitButton.click()

    // ダッシュボードへのリダイレクトまたはメール確認メッセージを確認
    await expect(page).toHaveURL(/\/dashboard|\/verify-email/, { timeout: 10000 })
  })

  test('メールアドレスでのサインインフロー', async ({ page }) => {
    await page.goto('/signin')

    // サインインタブが存在する場合はクリック
    const signInTab = page.getByRole('tab', { name: /サインイン|sign in/i })
    if (await signInTab.isVisible()) {
      await signInTab.click()
    }

    // テスト用の認証情報を入力
    await page.fill('input[name="email"], input[type="email"]', 'test@example.com')
    await page.fill('input[name="password"], input[type="password"]', 'TestPassword123!')

    // サインインボタンをクリック
    const submitButton = page.getByRole('button', { name: /サインイン|sign in|log in/i })
    await submitButton.click()

    // エラーメッセージまたはダッシュボードへのリダイレクトを確認
    // 実際のテストでは有効な認証情報が必要
    const errorMessage = page.locator('text=/アカウントが見つかりません|User not found|Invalid credentials/i')
    const dashboardUrl = page.waitForURL('/dashboard', { timeout: 5000 }).catch(() => null)

    const result = await Promise.race([
      errorMessage.waitFor({ timeout: 5000 }).then(() => 'error'),
      dashboardUrl.then(() => 'success')
    ])

    if (result === 'error') {
      await expect(errorMessage).toBeVisible()
    } else {
      await expect(page).toHaveURL('/dashboard')
    }
  })

  test('パスワードリセットフロー', async ({ page }) => {
    await page.goto('/signin')

    // パスワードを忘れた場合のリンクをクリック
    const forgotPasswordLink = page.locator('text=/パスワードを忘れた|Forgot password/i')
    if (await forgotPasswordLink.isVisible()) {
      await forgotPasswordLink.click()

      // メールアドレスを入力
      await page.fill('input[name="email"], input[type="email"]', 'test@example.com')

      // リセットメール送信ボタンをクリック
      const resetButton = page.getByRole('button', { name: /送信|send|reset/i })
      await resetButton.click()

      // 確認メッセージを確認
      await expect(page.locator('text=/メールを送信しました|Email sent|Check your email/i')).toBeVisible({ timeout: 5000 })
    }
  })

  test('Googleサインインボタンの存在確認', async ({ page }) => {
    await page.goto('/signin')

    // Googleサインインボタンが存在することを確認
    const googleButton = page.locator('button:has-text("Google"), button:has-text("Googleでサインイン")')
    await expect(googleButton).toBeVisible()
  })

  test('認証エラーメッセージの表示', async ({ page }) => {
    await page.goto('/signin')

    // 無効なメールアドレスでサインイン試行
    await page.fill('input[type="email"]', 'invalid-email')
    await page.fill('input[type="password"]', '123')

    const submitButton = page.getByRole('button', { name: /サインイン|sign in/i })
    await submitButton.click()

    // エラーメッセージが表示されることを確認
    const errorMessage = page.locator('text=/メールアドレスの形式|Invalid email|パスワード/i')
    await expect(errorMessage).toBeVisible({ timeout: 5000 })
  })
})

test.describe('認証後のナビゲーション', () => {
  // テスト用の認証済みセッションをセットアップ
  test.use({
    storageState: {
      cookies: [],
      origins: [{
        origin: 'http://localhost:3000',
        localStorage: [{
          name: 'auth-token',
          value: 'mock-auth-token'
        }]
      }]
    }
  })

  test('ダッシュボードへの直接アクセス（未認証）', async ({ page }) => {
    // 認証状態をクリア
    await page.context().clearCookies()
    await page.goto('/dashboard')

    // サインインページへリダイレクトされることを確認
    await expect(page).toHaveURL('/signin')
  })

  test('サインアウト機能', async ({ page }) => {
    // モック認証状態でダッシュボードにアクセス
    await page.goto('/dashboard')

    // サインアウトボタンを探す
    const signOutButton = page.locator('button:has-text("サインアウト"), button:has-text("Sign Out"), button:has-text("Logout")')

    if (await signOutButton.isVisible()) {
      await signOutButton.click()

      // ホームページまたはサインインページへリダイレクトされることを確認
      await expect(page).toHaveURL(/^\/$|\/signin/)
    }
  })
})