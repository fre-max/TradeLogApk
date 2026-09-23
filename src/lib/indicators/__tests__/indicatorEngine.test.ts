import { describe, it, expect, beforeEach } from 'vitest';
import {
  INDICATEURS_PAR_DEFAUT,
  recupererIndicateursStockes,
  sauvegarderIndicateurStocke,
  supprimerIndicateurStocke,
  reinitialiserIndicateursParDefaut,
  evaluerIndicateurScript,
  genererDefinitionsVariablesAutomatiques,
} from '../indicatorEngine';
import type { Bougie } from '@/lib/chartDataHelper';
import type { IndicatorScript, IndicatorContext } from '@/types/indicatorScript';

describe('Moteur d Indicateurs Scriptables - indicatorEngine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('charge correctement les indicateurs par défaut', () => {
    const indicateurs = recupererIndicateursStockes();
    expect(indicateurs.length).toBeGreaterThanOrEqual(7);
    expect(indicateurs.some(i => i.id === 'script-luxalgo-smc')).toBe(true);
    expect(indicateurs.some(i => i.id === 'script-protected-swings')).toBe(true);
    expect(indicateurs.some(i => i.id === 'script-zigzag-smc')).toBe(true);
    expect(indicateurs.some(i => i.id === 'script-unmitigated-profile')).toBe(true);
    expect(indicateurs.some(i => i.id === 'script-fvg-imbalance')).toBe(true);
    expect(indicateurs.some(i => i.id === 'script-detection-liquidite')).toBe(true);
    expect(indicateurs.some(i => i.id === 'script-sweep-spring-validation')).toBe(true);
    expect(indicateurs.some(i => i.id === 'script-detection-liquidite-eq')).toBe(true);
    expect(indicateurs.some(i => i.id === 'script-detection-liquidite-srtl')).toBe(true);
  });

  it('sauvegarde un nouvel indicateur et permet sa modification et suppression', () => {
    const nouvelIndicateur: IndicatorScript = {
      id: 'custom-indicator-test',
      nom: 'Mon Indicateur Test',
      description: 'Test de script',
      type: 'overlay',
      code: 'return { calculer: () => ({ donnees: { ok: true }, primitives: {} }) };',
      parametres: { seuil: 10 },
      actif: true,
      visibleSurGraphique: true,
      collecteActive: true,
      creeLe: new Date().toISOString(),
      misAJourLe: new Date().toISOString(),
    };

    sauvegarderIndicateurStocke(nouvelIndicateur);
    const liste = recupererIndicateursStockes();
    const trouve = liste.find(i => i.id === 'custom-indicator-test');
    expect(trouve).toBeDefined();
    expect(trouve?.nom).toBe('Mon Indicateur Test');

    supprimerIndicateurStocke('custom-indicator-test');
    const listeApres = recupererIndicateursStockes();
    expect(listeApres.find(i => i.id === 'custom-indicator-test')).toBeUndefined();
  });

  it('évalue un script personnalisé et retourne des primitives visuelles valides', () => {
    const codeCustom = `
      return {
        calculer: function(ctx) {
          const boites = [];
          if (ctx.bougies.length >= 2) {
            boites.push({
              prixHaut: 1.0850,
              prixBas: 1.0800,
              dateDebut: ctx.bougies[0].time,
              label: 'Test Box'
            });
          }
          return {
            donnees: { signal: 'HAUSSIER' },
            primitives: { boites }
          };
        }
      };
    `;

    const fauxContexte: IndicatorContext = {
      bougies: [
        { time: '2025-01-01 10:00', open: 1.080, high: 1.085, low: 1.079, close: 1.084 },
        { time: '2025-01-01 10:05', open: 1.084, high: 1.086, low: 1.083, close: 1.085 },
      ],
      parametres: {},
    };

    const resultat = evaluerIndicateurScript(codeCustom, fauxContexte);
    expect(resultat).not.toBeNull();
    expect(resultat?.donnees.signal).toBe('HAUSSIER');
    expect(resultat?.primitives?.boites?.length).toBe(1);
    expect(resultat?.primitives?.boites?.[0].label).toBe('Test Box');
  });

  it('gère les erreurs dans le code du script sans bloquer ni planter', () => {
    const codeErreur = `
      return {
        calculer: function() {
          throw new Error('Erreur intentionnelle de calcul');
        }
      };
    `;

    const fauxContexte: IndicatorContext = {
      bougies: [],
      parametres: {},
    };

    const resultat = evaluerIndicateurScript(codeErreur, fauxContexte);
    expect(resultat).toBeNull();
  });

  it('réinitialise les indicateurs officiels en cas de besoin', () => {
    supprimerIndicateurStocke('script-luxalgo-smc');
    expect(recupererIndicateursStockes().find(i => i.id === 'script-luxalgo-smc')).toBeUndefined();

    reinitialiserIndicateursParDefaut();
    expect(recupererIndicateursStockes().find(i => i.id === 'script-luxalgo-smc')).toBeDefined();
  });

  it('évalue les indicateurs officiels convertis en scripts et préserve typeSpecial', () => {
    const indicateurs = recupererIndicateursStockes();
    const smcScript = indicateurs.find(i => i.id === 'script-luxalgo-smc');
    expect(smcScript).toBeDefined();

    // 40 fausses bougies pour tester le calcul SMC
    const bougiesTest: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800 + (i % 2 === 0 ? 0.001 : -0.001),
      high: 1.0830,
      low: 1.0770,
      close: 1.0810,
    }));

    const res = evaluerIndicateurScript(smcScript!.code, {
      bougies: bougiesTest,
      parametres: smcScript!.parametres,
    });

    expect(res).not.toBeNull();
    expect(res?.typeSpecial).toBe('luxalgo-smc');
    expect(res?.donnees).toBeDefined();
    expect(res?.primitives).toBeDefined();
  });

  it('prend en compte les modifications de paramètres dynamiques dans le script', () => {
    const indicateurs = recupererIndicateursStockes();
    const swingScript = indicateurs.find(i => i.id === 'script-protected-swings');
    expect(swingScript).toBeDefined();

    const bougiesTest: Bougie[] = Array.from({ length: 30 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800,
      high: 1.0820 + i * 0.0001,
      low: 1.0780,
      close: 1.0810,
    }));

    // Exécution avec sweepSensitivity = 3
    const res1 = evaluerIndicateurScript(swingScript!.code, {
      bougies: bougiesTest,
      parametres: { sweepSensitivity: 3 },
    });

    // Exécution avec sweepSensitivity = 10
    const res2 = evaluerIndicateurScript(swingScript!.code, {
      bougies: bougiesTest,
      parametres: { sweepSensitivity: 10 },
    });

    expect(res1?.typeSpecial).toBe('protected-swings');
    expect(res2?.typeSpecial).toBe('protected-swings');
    expect(res1).not.toBeNull();
    expect(res2).not.toBeNull();
  });

  it('évalue avec succès l indicateur officiel Détection Liquidité EQH / EQL', () => {
    const indicateurs = recupererIndicateursStockes();
    const eqScript = indicateurs.find(i => i.id === 'script-detection-liquidite-eq');
    expect(eqScript).toBeDefined();

    const bougiesTest: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800,
      high: 1.0810,
      low: 1.0790,
      close: 1.0805,
    }));
    bougiesTest[10].high = 1.0850;
    bougiesTest[22].high = 1.0851;

    const res = evaluerIndicateurScript(eqScript!.code, {
      bougies: bougiesTest,
      parametres: eqScript!.parametres,
    });

    expect(res).not.toBeNull();
    expect(res?.typeSpecial).toBe('detection-liquidite-eq');
    expect(res?.primitives?.lignes).toBeDefined();
  });

  it('évalue avec succès l indicateur officiel Détection Liquidité S/R & Trendline', () => {
    const indicateurs = recupererIndicateursStockes();
    const srtlScript = indicateurs.find(i => i.id === 'script-detection-liquidite-srtl');
    expect(srtlScript).toBeDefined();

    const bougiesTest: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800,
      high: 1.0810,
      low: 1.0790,
      close: 1.0805,
    }));
    bougiesTest[10].high = 1.0850;
    bougiesTest[22].high = 1.0850;

    const res = evaluerIndicateurScript(srtlScript!.code, {
      bougies: bougiesTest,
      parametres: srtlScript!.parametres,
    });

    expect(res).not.toBeNull();
    expect(res?.typeSpecial).toBe('detection-liquidite-srtl');
    expect(res?.primitives?.lignes).toBeDefined();
  });

  it('génère automatiquement des définitions de variables externes à partir d objets de paramètres bruts', () => {
    const paramsTest = {
      periodeRapide: 12,
      seuilSensibilite: 2.5,
      activerFiltre: true,
      nomStrategie: 'SMC Aggressif',
    };

    const defs = genererDefinitionsVariablesAutomatiques(paramsTest);
    expect(defs.length).toBe(4);

    const defPeriode = defs.find((d) => d.cle === 'periodeRapide');
    expect(defPeriode?.type).toBe('number');
    expect(defPeriode?.step).toBe(1);
    expect(defPeriode?.label).toBe('Periode Rapide');

    const defSeuil = defs.find((d) => d.cle === 'seuilSensibilite');
    expect(defSeuil?.type).toBe('number');
    expect(defSeuil?.step).toBe(0.1);

    const defFiltre = defs.find((d) => d.cle === 'activerFiltre');
    expect(defFiltre?.type).toBe('boolean');
    expect(defFiltre?.valeurParDefaut).toBe(true);

    const defNom = defs.find((d) => d.cle === 'nomStrategie');
    expect(defNom?.type).toBe('string');
  });

  it('fournit des definitionsVariables riches en français pour les 4 indicateurs officiels', () => {
    const indicateurs = recupererIndicateursStockes();
    const smc = indicateurs.find((i) => i.id === 'script-luxalgo-smc');
    expect(smc?.definitionsVariables).toBeDefined();
    expect(smc?.definitionsVariables?.length).toBeGreaterThanOrEqual(6);

    const swingLengthDef = smc?.definitionsVariables?.find((d) => d.cle === 'swingLength');
    expect(swingLengthDef?.label).toBe('Longueur des Swings Majeurs');
    expect(swingLengthDef?.min).toBe(5);
    expect(swingLengthDef?.max).toBe(100);

    const swings = indicateurs.find((i) => i.id === 'script-protected-swings');
    expect(swings?.definitionsVariables?.some((d) => d.cle === 'sweepSensitivity')).toBe(true);

    const zz = indicateurs.find((i) => i.id === 'script-zigzag-smc');
    expect(zz?.definitionsVariables?.some((d) => d.cle === 'depth')).toBe(true);

    const uvp = indicateurs.find((i) => i.id === 'script-unmitigated-profile');
    expect(uvp?.definitionsVariables?.some((d) => d.cle === 'zigzagDepth')).toBe(true);
  });
});
