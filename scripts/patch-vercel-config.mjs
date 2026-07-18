/**
 * Script post-build qui corrige les types MIME dans .vercel/output/config.json
 * 
 * Problème : Vercel sert les fichiers .js avec "application/octet-stream"
 * au lieu de "application/javascript" quand on utilise la Build Output API.
 * 
 * Solution : On insère des règles de headers AVANT le "handle": "filesystem"
 * pour forcer le bon Content-Type sur les fichiers JS et CSS.
 * 
 * Exemple : node scripts/patch-vercel-config.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'

const CHEMIN_CONFIG = '.vercel/output/config.json'

// Vérifier que le fichier existe (il est généré par vite-plugin-vercel)
if (!existsSync(CHEMIN_CONFIG)) {
  console.log('⚠️ [patch] Fichier .vercel/output/config.json introuvable, skip.')
  process.exit(0)
}

// Lire la config existante
const config = JSON.parse(readFileSync(CHEMIN_CONFIG, 'utf-8'))

// Règles de headers MIME à ajouter pour les fichiers statiques
const reglesHeaders = [
  {
    src: '/assets/(.+)\\.js$',
    headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    continue: true,
  },
  {
    src: '/assets/(.+)\\.css$',
    headers: { 'Content-Type': 'text/css; charset=utf-8' },
    continue: true,
  },
]

// Trouver l'index du "handle": "filesystem" pour insérer les règles juste avant
const indexFilesystem = config.routes.findIndex(
  (route) => route.handle === 'filesystem'
)

if (indexFilesystem === -1) {
  console.log('⚠️ [patch] Route "handle: filesystem" introuvable, skip.')
  process.exit(0)
}

// Insérer les règles de MIME type avant le "handle: filesystem"
config.routes.splice(indexFilesystem, 0, ...reglesHeaders)

// Sauvegarder le fichier modifié
writeFileSync(CHEMIN_CONFIG, JSON.stringify(config, null, 2))
console.log('✅ [patch] Headers MIME ajoutés dans .vercel/output/config.json')
