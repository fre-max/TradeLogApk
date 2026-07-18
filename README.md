# TradeLog

Journal de backtesting SMC — React + TypeScript + Supabase

## Stack
- **Frontend** : React + Vite + TypeScript + Tailwind CSS
- **State** : Zustand + TanStack Query
- **Table** : TanStack Table v8
- **Forms** : React Hook Form + Zod
- **Backend** : Supabase (Auth + PostgreSQL + Storage)
- **Serverless** : Vercel Functions (Telegram Bot)

## Setup

```bash
npm install
cp .env.example .env.local
# Remplir les variables dans .env.local
npm run dev
```

## Variables d'environnement

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé publique Supabase |
| `TELEGRAM_BOT_TOKEN` | Token du bot Telegram (serveur uniquement) |

## Structure

```
src/
├── types/        # Types TypeScript + schémas Zod
├── lib/          # Supabase client, storage, utils
├── store/        # Zustand stores (UI + filtres)
├── hooks/        # TanStack Query hooks
├── components/   # Composants React
│   ├── layout/   # Sidebar, Topbar
│   ├── trade/    # Table, Drawer, Detail, StepBlock
│   └── fields/   # ComboField, ImageField
└── pages/        # Journal, Auth

api/
└── telegram.ts   # Vercel Serverless Function
```

## Supabase — Tables à créer

Voir `/supabase/schema.sql`
# MyLog
