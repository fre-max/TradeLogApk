/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : CANDLESTICKS PATTERNS IDENTIFIED (REPO32)
 * Traduit et adapté depuis l'indicateur TradingView "Candlesticks Patterns Identified (update 1-17-26)" par repo32
 * 
 * 💡 UTILISATION SANS RÉINSTALLER L'APK :
 * 1. Transférez ce fichier sur votre smartphone (téléchargement, WhatsApp, etc.).
 * 2. Ouvrez l'application TradeLog sur votre smartphone.
 * 3. Allez dans le Backtest -> Cliquez sur "Indicateurs".
 * 4. Cliquez sur "Importer" et sélectionnez ce fichier.
 * 5. L'indicateur est immédiatement actif sur vos graphiques !
 * ==============================================================================
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 2) {
      return { donnees: {}, primitives: { labels: [] } };
    }

    // 1️⃣ Extraction des paramètres utilisateur
    const params = parametres || {};
    const dojiSize = Number(params.dojiSize !== undefined ? params.dojiSize : 0.05);
    const activerFiltreTendance = Boolean(params.activerFiltreTendance);
    const trendBars = Math.max(1, Number(params.trendBars !== undefined ? params.trendBars : 5));
    const bullColor = params.bullColor || '#00E676';
    const bearColor = params.bearColor || '#F23645';
    const dojiColor = params.dojiColor || '#FFFFFF';

    // Interrupteurs individuels pour les 15 figures
    const actDoji = params.activerDoji !== false;
    const actBearHarami = params.activerBearishHarami !== false;
    const actBullHarami = params.activerBullishHarami !== false;
    const actBearEngulf = params.activerBearishEngulfing !== false;
    const actBullEngulf = params.activerBullishEngulfing !== false;
    const actPiercing = params.activerPiercingLine !== false;
    const actBullBelt = params.activerBullishBelt !== false;
    const actBullKicker = params.activerBullishKicker !== false;
    const actBearKicker = params.activerBearishKicker !== false;
    const actHangingMan = params.activerHangingMan !== false;
    const actEveningStar = params.activerEveningStar !== false;
    const actMorningStar = params.activerMorningStar !== false;
    const actShootingStar = params.activerShootingStar !== false;
    const actHammer = params.activerHammer !== false;
    const actInvertedHammer = params.activerInvertedHammer !== false;

    const motifs = [];
    const labels = [];
    let countHaussiers = 0;
    let countBaissiers = 0;
    let countDojis = 0;

    // 2️⃣ Analyse séquentielle de chaque bougie
    for (let i = 0; i < bougies.length; i++) {
      const b = bougies[i];
      const open = b.open;
      const high = b.high;
      const low = b.low;
      const close = b.close;
      const range = high - low;
      const corps = Math.abs(open - close);

      const bPrec = i >= 1 ? bougies[i - 1] : null;
      const open1 = bPrec ? bPrec.open : open;
      const close1 = bPrec ? bPrec.close : close;
      const high1 = bPrec ? bPrec.high : high;
      const low1 = bPrec ? bPrec.low : low;

      const bPrec2 = i >= 2 ? bougies[i - 2] : null;
      const open2 = bPrec2 ? bPrec2.open : open;
      const close2 = bPrec2 ? bPrec2.close : close;

      const idxTrend = Math.max(0, i - trendBars);
      const openTrend = bougies[idxTrend].open;

      const tendanceHausse = !activerFiltreTendance || openTrend < open;
      const tendanceBaisse = !activerFiltreTendance || openTrend > open;

      // 1. DOJI
      if (actDoji && range > 0 && corps <= range * dojiSize) {
        motifs.push({ nom: 'Doji', type: 'NEUTRAL', index: i, temps: b.time });
        labels.push({
          id: 'doji-' + i,
          prix: high,
          date: b.time,
          texte: 'Doji',
          couleur: dojiColor,
          position: 'above'
        });
        countDojis++;
      }

      if (!bPrec) continue;

      // 2. BEARISH HARAMI
      if (
        actBearHarami &&
        close1 > open1 &&
        open > close &&
        open <= close1 &&
        open1 <= close &&
        (open - close) < (close1 - open1) &&
        tendanceHausse
      ) {
        motifs.push({ nom: 'Bearish Harami', type: 'BEARISH', index: i, temps: b.time });
        labels.push({
          id: 'bear-harami-' + i,
          prix: high,
          date: b.time,
          texte: 'Bearish\nHarami',
          couleur: bearColor,
          position: 'above'
        });
        countBaissiers++;
      }

      // 3. BULLISH HARAMI
      if (
        actBullHarami &&
        open1 > close1 &&
        close > open &&
        close <= open1 &&
        close1 <= open &&
        (close - open) < (open1 - close1) &&
        tendanceBaisse
      ) {
        motifs.push({ nom: 'Bullish Harami', type: 'BULLISH', index: i, temps: b.time });
        labels.push({
          id: 'bull-harami-' + i,
          prix: low,
          date: b.time,
          texte: 'Bullish\nHarami',
          couleur: bullColor,
          position: 'below'
        });
        countHaussiers++;
      }

      // 4. BEARISH ENGULFING
      if (
        actBearEngulf &&
        close1 > open1 &&
        open > close &&
        open >= close1 &&
        open1 >= close &&
        (open - close) > (close1 - open1) &&
        tendanceHausse
      ) {
        motifs.push({ nom: 'Bearish Engulfing', type: 'BEARISH', index: i, temps: b.time });
        labels.push({
          id: 'bear-engulf-' + i,
          prix: high,
          date: b.time,
          texte: 'Bearish\nEngulfing',
          couleur: bearColor,
          position: 'above'
        });
        countBaissiers++;
      }

      // 5. BULLISH ENGULFING
      if (
        actBullEngulf &&
        open1 > close1 &&
        close > open &&
        close >= open1 &&
        close1 >= open &&
        (close - open) > (open1 - close1) &&
        tendanceBaisse
      ) {
        motifs.push({ nom: 'Bullish Engulfing', type: 'BULLISH', index: i, temps: b.time });
        labels.push({
          id: 'bull-engulf-' + i,
          prix: low,
          date: b.time,
          texte: 'Bullish\nEngulfing',
          couleur: bullColor,
          position: 'below'
        });
        countHaussiers++;
      }

      // 6. PIERCING LINE
      if (
        actPiercing &&
        close1 < open1 &&
        open < low1 &&
        close > (close1 + (open1 - close1) / 2) &&
        close < open1 &&
        tendanceBaisse
      ) {
        motifs.push({ nom: 'Piercing Line', type: 'BULLISH', index: i, temps: b.time });
        labels.push({
          id: 'piercing-' + i,
          prix: low,
          date: b.time,
          texte: 'Piercing\nLine',
          couleur: bullColor,
          position: 'below'
        });
        countHaussiers++;
      }

      // 7. BULLISH BELT
      if (actBullBelt && i >= 10) {
        let min10 = bougies[i - 1].low;
        for (let k = 2; k <= 10; k++) {
          if (bougies[i - k].low < min10) min10 = bougies[i - k].low;
        }
        const lowQuasiOpen = Math.abs(low - open) <= (range * 0.02 || 0.0001);
        if (
          lowQuasiOpen &&
          open < min10 &&
          open < close &&
          close > ((high1 - low1) / 2 + low1) &&
          tendanceBaisse
        ) {
          motifs.push({ nom: 'Bullish Belt', type: 'BULLISH', index: i, temps: b.time });
          labels.push({
            id: 'bull-belt-' + i,
            prix: low,
            date: b.time,
            texte: 'Bullish\nBelt',
            couleur: bullColor,
            position: 'below'
          });
          countHaussiers++;
        }
      }

      // 8. BULLISH KICKER
      if (
        actBullKicker &&
        open1 > close1 &&
        open >= open1 &&
        close > open &&
        tendanceBaisse
      ) {
        motifs.push({ nom: 'Bullish Kicker', type: 'BULLISH', index: i, temps: b.time });
        labels.push({
          id: 'bull-kicker-' + i,
          prix: low,
          date: b.time,
          texte: 'Bullish\nKicker',
          couleur: bullColor,
          position: 'below'
        });
        countHaussiers++;
      }

      // 9. BEARISH KICKER
      if (
        actBearKicker &&
        open1 < close1 &&
        open <= open1 &&
        close <= open &&
        tendanceHausse
      ) {
        motifs.push({ nom: 'Bearish Kicker', type: 'BEARISH', index: i, temps: b.time });
        labels.push({
          id: 'bear-kicker-' + i,
          prix: high,
          date: b.time,
          texte: 'Bearish\nKicker',
          couleur: bearColor,
          position: 'above'
        });
        countBaissiers++;
      }

      // 10. HANGING MAN
      if (actHangingMan && bPrec2 && range > 0) {
        const denom = 0.001 + range;
        if (
          range > 4 * corps &&
          (close - low) / denom >= 0.75 &&
          (open - low) / denom >= 0.75 &&
          high1 < open &&
          bPrec2.high < open &&
          tendanceHausse
        ) {
          motifs.push({ nom: 'Hanging Man', type: 'BEARISH', index: i, temps: b.time });
          labels.push({
            id: 'hanging-' + i,
            prix: high,
            date: b.time,
            texte: 'Hanging\nMan',
            couleur: bearColor,
            position: 'above'
          });
          countBaissiers++;
        }
      }

      // 11. EVENING STAR
      if (actEveningStar && bPrec2) {
        const minCorps1 = Math.min(open1, close1);
        if (
          close2 > open2 &&
          minCorps1 > close2 &&
          open < minCorps1 &&
          close < open
        ) {
          motifs.push({ nom: 'Evening Star', type: 'BEARISH', index: i, temps: b.time });
          labels.push({
            id: 'evening-star-' + i,
            prix: high,
            date: b.time,
            texte: 'Evening\nStar',
            couleur: bearColor,
            position: 'above'
          });
          countBaissiers++;
        }
      }

      // 12. MORNING STAR
      if (actMorningStar && bPrec2) {
        const maxCorps1 = Math.max(open1, close1);
        if (
          close2 < open2 &&
          maxCorps1 < close2 &&
          open > maxCorps1 &&
          close > open
        ) {
          motifs.push({ nom: 'Morning Star', type: 'BULLISH', index: i, temps: b.time });
          labels.push({
            id: 'morning-star-' + i,
            prix: low,
            date: b.time,
            texte: 'Morning\nStar',
            couleur: bullColor,
            position: 'below'
          });
          countHaussiers++;
        }
      }

      // 13. SHOOTING STAR
      if (actShootingStar && range > 0) {
        const mecheHaute = high - Math.max(open, close);
        const mecheBasse = Math.min(close, open) - low;
        const corpsVal = Math.max(0.00001, corps);
        if (
          open1 < close1 &&
          open > close1 &&
          mecheHaute >= corpsVal * 3 &&
          mecheBasse <= corpsVal
        ) {
          motifs.push({ nom: 'Shooting Star', type: 'BEARISH', index: i, temps: b.time });
          labels.push({
            id: 'shooting-star-' + i,
            prix: high,
            date: b.time,
            texte: 'Shooting\nStar',
            couleur: bearColor,
            position: 'above'
          });
          countBaissiers++;
        }
      }

      // 14. HAMMER ("H")
      if (actHammer && range > 0) {
        const denom = 0.001 + range;
        if (
          range > 3 * corps &&
          (close - low) / denom > 0.6 &&
          (open - low) / denom > 0.6
        ) {
          motifs.push({ nom: 'Hammer', type: 'BULLISH', index: i, temps: b.time });
          labels.push({
            id: 'hammer-' + i,
            prix: low,
            date: b.time,
            texte: 'H',
            couleur: bullColor,
            position: 'below'
          });
          countHaussiers++;
        }
      }

      // 15. INVERTED HAMMER ("IH")
      if (actInvertedHammer && range > 0) {
        const denom = 0.001 + range;
        if (
          range > 3 * corps &&
          (high - close) / denom > 0.6 &&
          (high - open) / denom > 0.6
        ) {
          motifs.push({ nom: 'Inverted Hammer', type: 'BULLISH', index: i, temps: b.time });
          labels.push({
            id: 'inv-hammer-' + i,
            prix: low,
            date: b.time,
            texte: 'IH',
            couleur: bullColor,
            position: 'below'
          });
          countHaussiers++;
        }
      }
    }

    return {
      donnees: {
        motifs: motifs,
        statistiques: {
          totalMotifs: motifs.length,
          totalHaussiers: countHaussiers,
          totalBaissiers: countBaissiers,
          totalDojis: countDojis
        }
      },
      primitives: {
        labels: labels
      },
      typeSpecial: 'candlestick-patterns'
    };
  }
};
