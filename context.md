+---------------------------------------------------------------------------------------------------+
| [Switch Mode Fondamental: ON]   Paire: EUR/USD   |   Biais Global: [ BULLISH EUR/USD (+4.5) ]      |
+---------------------------------------------------------------------------------------------------+
|  [▼ Table EUR (Score: +1.5)]                                      [▼ Table USD (Score: -3.0)]    |
|  +---------------------------+                                    +---------------------------+   |
|  | Event      | Impact| Score|                                    | Event      | Impact| Score|   |
|  | PMI Serv.  |  +1   |  +2  |                                    | CPI YoY    |  -1   |  -3  |   |
|  | Rate Dec.  |  -1   |  -1  |                                    | NFP        |   0   |   0  |   |
|  +---------------------------+                                    +---------------------------+   |
|  | SCORE TOTAL EUR : +1.5    |                                    | SCORE TOTAL USD : -3.0    |   |
|                                                                                                   |
|                                                                                                   |
|                                    [ GRAPHIQUE DU PRIX ]                                          |
|                                  (TradingView / Backtest)                                         |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+

### Éléments Clés de l'UI :
 1. **Switch "Mode Fondamental" :** Un bouton toggle dans l'interface du backtest permettant d'activer/désactiver la superposition des données macro sans perturber le graphique.
 2. **Tableaux Récapitulatifs Dépliables / Pliables (Collapsible Accordion Widgets) :**
   * **En haut à gauche :** Petit tableau récapitulatif des données économiques de la **Devise A** (ex: Euro).
   * **En haut à droite :** Petit tableau récapitulatif des données économiques de la **Devise B** (ex: USD).
   * **Bout du Tableau / Pied de composant :** Affiche clairement le **Score Total de Force** de la devise concernée.
   * **Capacité Pliable (Foldable) :** Les deux tableaux sont rétractables/repliables en 1 clic. Lorsqu'ils sont pliés, seul un mini-badge (drapeau + score) reste visible pour libérer 100% du graphique du prix.
 3. **Badge de Biais Relatif Central :**
   * Affiche le résultat net du Biais (Score EUR - Score USD).
   * Coloration explicite : Vert pour BULLISH, Rouge pour BEARISH, Gris pour NEUTRE.
 4. **Interactivité Bar-Replay (Backtest Temps Réel) :**
   * À mesure que l'utilisateur fait avancer le temps bougie par bougie sur le graphique de backtest, les cartes macro recalculent et mettent à jour dynamiquement les données économiques et le score de biais en fonction des dates.
## 4. Structure des Données (Données Macro CSV)
L'utilisateur compte constituer une banque de données en importants des fichiers CSV. Le format de donnée attendu est le suivant :
csv
date,asset,event,category,actual,forecast,previous,impact_weight
2024-03-12 12:30:00,USD,CPI YoY,inflation,3.2,3.1,3.1,3
2024-03-08 13:30:00,USD,Non Farm Payrolls,employment,275,200,229,3
2024-03-07 13:15:00,EUR,ECB Rate Decision,interest_rate,4.50,4.50,4.50,4

`
## 5. Attentes vis-à-vis de l'Agent IA de Code
L'agent IA recevant ce contexte doit :
 1. Analyser le dépôt TradeLog pour comprendre sa stack technique actuelle.
 2. Créer le moteur de scoring et d'ingestion de fichiers CSV macro.
 3. Implémenter le switch "Mode Fondamental" et les cartes/tableaux pliables superposés en haut à gauche et haut à droite du graphique.
 4. Assurer la synchronisation dynamique du score avec le moteur de Bar-Replay existant.