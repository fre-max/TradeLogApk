import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useOfflineSyncStore } from '@/store/offlineSyncStore';
import { useLocalDatabase } from '@/store/useLocalDatabase';
import { useOfflineSyncManager } from '@/hooks/useOfflineSyncManager';
import { cn } from '@/lib/utils';

/**
 * Badge de synchronisation Cloud — affiché dans la Topbar.
 *
 * Indique en un coup d'œil si les données du téléphone = celles du Cloud.
 *
 * États possibles :
 *   🟢 Synchronisé   : local et cloud ont le même nombre de trades, file vide
 *   🟡 En attente    : des trades sont en file d'attente (pas encore envoyés)
 *   🔵 Cloud en avance: le cloud a plus de trades que le local (nouveautés à télécharger)
 *   ⏳ En cours       : sync en cours de traitement
 *   🔴 Non connecté  : pas de session cloud active
 */
export function SyncCloudBadge() {
  const { queue, syncEnCours, derniereSynchroReussie } = useOfflineSyncStore();
  const { trades: tradesLocaux } = useLocalDatabase();
  const { syncAll, synchroniserFileDAttente } = useOfflineSyncManager();

  // Nombre de trades sur le Cloud (récupéré périodiquement)
  const [nbTradesCloud, setNbTradesCloud] = useState<number | null>(null);

  // Email de l'utilisateur connecté (null = pas connecté)
  const [emailConnecte, setEmailConnecte] = useState<string | null>(null);

  // État du popover (ouvert / fermé)
  const [popoverOuvert, setPopoverOuvert] = useState(false);

  // Pour fermer le popover en cliquant en dehors
  const refBadge = useRef<HTMLDivElement>(null);

  // Indique si un re-sync manuel est en cours depuis le popover
  const [syncManuelleEnCours, setSyncManuelleEnCours] = useState(false);

  // ─── Récupération légère du nombre de trades Cloud ───────────────
  // On fait juste un COUNT (head: true), sans charger les données,
  // pour ne pas consommer de bande passante.
  const rafraichirCompteCloud = useCallback(async () => {
    if (!navigator.onLine) return;

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      setEmailConnecte(null);
      setNbTradesCloud(null);
      return;
    }

    // Mémoriser l'email de l'utilisateur connecté
    setEmailConnecte(sessionData.session.user.email ?? null);

    // Compte uniquement les trades de l'utilisateur connecté
    const { count } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', sessionData.session.user.id);

    if (count !== null) {
      setNbTradesCloud(count);
    }
  }, []);

  // Rafraîchir au montage et toutes les 60 secondes
  useEffect(() => {
    rafraichirCompteCloud();
    const interval = setInterval(rafraichirCompteCloud, 60_000);
    return () => clearInterval(interval);
  }, [rafraichirCompteCloud]);

  // Fermer le popover en cliquant en dehors du badge
  useEffect(() => {
    const fermerSiClic = (event: MouseEvent) => {
      if (refBadge.current && !refBadge.current.contains(event.target as Node)) {
        setPopoverOuvert(false);
      }
    };
    document.addEventListener('mousedown', fermerSiClic);
    return () => document.removeEventListener('mousedown', fermerSiClic);
  }, []);

  // ─── Calcul du statut à afficher ─────────────────────────────────
  const nbLocaux = tradesLocaux.length;
  const nbEnAttente = queue.length;

  type Statut = 'loading' | 'offline' | 'pending' | 'behind' | 'synced';
  let statut: Statut;

  if (syncEnCours || syncManuelleEnCours) {
    statut = 'loading';
  } else if (!emailConnecte) {
    statut = 'offline';
  } else if (nbEnAttente > 0) {
    // Des trades attendent d'être envoyés sur le cloud
    statut = 'pending';
  } else if (nbTradesCloud !== null && nbTradesCloud > nbLocaux) {
    // Le cloud a plus de trades que le local → il faut télécharger
    statut = 'behind';
  } else {
    statut = 'synced';
  }

  // ─── Synchronisation manuelle depuis le popover ──────────────────
  const lancerSyncManuelle = async () => {
    if (syncManuelleEnCours || !emailConnecte) return;

    setSyncManuelleEnCours(true);
    try {
      // 1. Envoyer d'abord les trades en attente vers Supabase
      await synchroniserFileDAttente();
      // 2. Télécharger ensuite les dernières nouveautés du Cloud
      await syncAll();
      // 3. Mettre à jour le compteur Cloud
      await rafraichirCompteCloud();
    } finally {
      setSyncManuelleEnCours(false);
    }
  };

  // ─── Formatage de la date de dernière sync ───────────────────────
  const formaterDerniereSync = (isoDate: string | null): string => {
    if (!isoDate) return 'Jamais';

    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH}h`;
    return `Il y a ${Math.floor(diffH / 24)} jour(s)`;
  };

  // ─── Apparence du badge selon le statut ──────────────────────────
  const configBadge = {
    loading: {
      bg: 'bg-[#2a2e39] border-[#3d4259]',
      text: 'text-blue-300',
      icone: '⏳',
      label: 'Sync...',
    },
    offline: {
      bg: 'bg-[#2a2e39] border-[#3d3030]',
      text: 'text-txt3',
      icone: '○',
      label: 'Hors-ligne',
    },
    pending: {
      bg: 'bg-amber-950/80 border-amber-700/50',
      text: 'text-amber-300',
      icone: '⏳',
      label: `${nbEnAttente} en attente`,
    },
    behind: {
      bg: 'bg-blue-950/80 border-blue-700/50',
      text: 'text-blue-300',
      icone: '⬇',
      label: 'Nouveautés',
    },
    synced: {
      bg: 'bg-emerald-950/80 border-emerald-700/50',
      text: 'text-emerald-400',
      icone: '✓',
      label: `${nbLocaux}/${nbTradesCloud ?? nbLocaux}`,
    },
  };

  const cfg = configBadge[statut];

  return (
    <div ref={refBadge} className="relative flex-shrink-0">

      {/* ── Badge principal (toujours visible dans la Topbar) ── */}
      <button
        onClick={() => setPopoverOuvert((prev) => !prev)}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-semibold transition-all select-none',
          cfg.bg,
          cfg.text
        )}
        title="Statut de synchronisation Cloud — cliquer pour les détails"
      >
        <span className={statut === 'loading' ? 'animate-pulse' : ''}>{cfg.icone}</span>
        <span className="hidden sm:inline">{cfg.label}</span>
      </button>

      {/* ── Popover de détail (s'ouvre au clic sur le badge) ── */}
      {popoverOuvert && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-surface border border-border rounded-xl shadow-2xl z-[500] overflow-hidden">

          {/* En-tête */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-txt font-semibold text-[13px]">☁️ Synchronisation Cloud</span>
            <button
              onClick={() => setPopoverOuvert(false)}
              className="text-txt3 hover:text-txt text-[16px] leading-none"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-3">

            {/* Compte connecté */}
            <LigneInfo
              icone="👤"
              label="Compte"
              valeur={emailConnecte ?? '— Non connecté'}
              couleur={emailConnecte ? 'text-txt' : 'text-txt3'}
            />

            {/* Séparateur */}
            <div className="border-t border-border" />

            {/* Comparaison des données */}
            <div className="space-y-2">
              <LigneInfo
                icone="📱"
                label="Sur ce téléphone"
                valeur={`${nbLocaux} trade${nbLocaux !== 1 ? 's' : ''}`}
                couleur="text-txt"
              />

              <LigneInfo
                icone="☁️"
                label="Sur le Cloud"
                valeur={
                  !emailConnecte
                    ? 'Non connecté'
                    : nbTradesCloud === null
                    ? '...'
                    : `${nbTradesCloud} trade${nbTradesCloud !== 1 ? 's' : ''}`
                }
                couleur={
                  !emailConnecte
                    ? 'text-txt3'
                    : nbTradesCloud === nbLocaux && nbEnAttente === 0
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }
              />

              <LigneInfo
                icone="📤"
                label="En attente d'envoi"
                valeur={`${nbEnAttente} trade${nbEnAttente !== 1 ? 's' : ''}`}
                couleur={nbEnAttente === 0 ? 'text-emerald-400' : 'text-amber-400'}
              />
            </div>

            {/* Séparateur */}
            <div className="border-t border-border" />

            {/* Dernière synchronisation */}
            <LigneInfo
              icone="🕐"
              label="Dernière sync"
              valeur={formaterDerniereSync(derniereSynchroReussie)}
              couleur="text-txt3"
            />

            {/* Message de statut contextuel */}
            {statut === 'synced' && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/40 border border-emerald-800/40 rounded-lg">
                <span>✅</span>
                <p className="text-emerald-400 text-[11px]">
                  Téléphone et Cloud sont identiques.
                </p>
              </div>
            )}
            {statut === 'pending' && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-950/40 border border-amber-800/40 rounded-lg">
                <span>⚠️</span>
                <p className="text-amber-300 text-[11px]">
                  {nbEnAttente} trade{nbEnAttente > 1 ? 's' : ''} en attente.
                  Vérifiez votre connexion Internet et votre session cloud.
                </p>
              </div>
            )}
            {statut === 'behind' && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-950/40 border border-blue-800/40 rounded-lg">
                <span>ℹ️</span>
                <p className="text-blue-300 text-[11px]">
                  Le Cloud a {(nbTradesCloud ?? 0) - nbLocaux} trade(s) de plus que ce téléphone.
                  Synchronisez pour les récupérer.
                </p>
              </div>
            )}
            {statut === 'offline' && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-surface2 border border-border2 rounded-lg">
                <span>🔒</span>
                <p className="text-txt3 text-[11px]">
                  Mode hors-ligne. Connectez-vous dans Paramètres pour synchroniser vos données.
                </p>
              </div>
            )}

            {/* Bouton Synchroniser maintenant (visible uniquement si connecté) */}
            {emailConnecte && (
              <button
                onClick={lancerSyncManuelle}
                disabled={syncManuelleEnCours || syncEnCours}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[12px] font-semibold transition-all',
                  syncManuelleEnCours || syncEnCours
                    ? 'bg-surface2 text-txt3 cursor-not-allowed'
                    : 'bg-accent text-white hover:bg-accent/90 active:scale-95'
                )}
              >
                {syncManuelleEnCours || syncEnCours ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-txt3 border-t-white rounded-full animate-spin" />
                    Synchronisation en cours...
                  </>
                ) : (
                  '🔄 Synchroniser maintenant'
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ligne d'information générique (icone + label + valeur) ──────────────────
// Composant interne pour éviter la répétition dans le popover.
function LigneInfo({
  icone,
  label,
  valeur,
  couleur = 'text-txt',
}: {
  icone: string;
  label: string;
  valeur: string;
  couleur?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-txt3 text-[12px]">
        {icone} {label}
      </span>
      <span className={cn('text-[12px] font-semibold', couleur)}>{valeur}</span>
    </div>
  );
}
