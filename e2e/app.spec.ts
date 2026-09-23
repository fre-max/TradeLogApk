import { test, expect } from '@playwright/test';

// Test End-to-End validant le chargement initial de l application TradeLog
test.describe('Application Mobile TradeLog', () => {
  test('charge la page d accueil avec succès', async ({ page }) => {
    // 1️⃣ Accès à la racine de l'application
    await page.goto('/');

    // 2️⃣ Vérification du titre du document
    await expect(page).toHaveTitle(/tradelog/i);

    // 3️⃣ Vérification que le conteneur principal de React est présent
    const rootElement = page.locator('#root');
    await expect(rootElement).toBeVisible();
  });
});
