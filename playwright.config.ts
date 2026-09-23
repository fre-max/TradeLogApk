import { defineConfig, devices } from '@playwright/test';

// Configuration de Playwright adaptée au test d'une application mobile (Capacitor/Vite)
export default defineConfig({
  // Répertoire contenant les scénarios de test E2E
  testDir: './e2e',

  // Exécution parallèle des tests pour gagner du temps
  fullyParallel: true,

  // Rapport au format HTML avec traces et captures d'écran en cas d'erreur
  reporter: 'html',

  use: {
    // Adresse locale du serveur Vite
    baseURL: 'http://localhost:5173',

    // Enregistrement des traces au premier échec pour faciliter le débogage
    trace: 'on-first-retry',
  },

  // Appareils émulés : priorité à l'expérience mobile pour TradeLog
  projects: [
    {
      name: 'Mobile Chrome (Pixel 7)',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'Mobile Safari (iPhone 14)',
      use: { ...devices['iPhone 14'] },
    },
  ],

  // Lance automatiquement le serveur Vite avant les tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
