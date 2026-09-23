import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Configuration de Vitest pour exécuter les tests avec l'environnement jsdom
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Même alias de chemin que vite.config.ts pour importer depuis @/
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Active les globales (describe, it, expect) pour éviter de les importer manuellement
    globals: true,
    // Simule l'environnement d'un navigateur
    environment: 'jsdom',
    // Fichier exécuté avant chaque suite de tests
    setupFiles: './src/test/setup.ts',
    // Inclut uniquement les tests de src
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Exclut les tests E2E gérés par Playwright
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
