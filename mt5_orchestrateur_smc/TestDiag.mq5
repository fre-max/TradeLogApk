//+------------------------------------------------------------------+
//|                                                   TestDiag.mq5   |
//+------------------------------------------------------------------+
#property copyright "JournalMobileAPK"
#property version   "1.00"

void OnStart()
{
   ResetLastError();
   Print("🚀 [Script Lancement] Attachement de ScannerMultiPairesSMC sur EURUSD H1...");
   
   int handle = iCustom("EURUSD", PERIOD_H1, "ScannerMultiPairesSMC");
   if(handle == INVALID_HANDLE)
   {
      Print("❌ Échec iCustom ScannerMultiPairesSMC: ", GetLastError());
      handle = iCustom("EURUSD", PERIOD_H1, "SMC_Orchestrateur\\ScannerMultiPairesSMC");
   }
   
   if(handle != INVALID_HANDLE)
   {
      bool res = ChartIndicatorAdd(0, 0, handle);
      Print("✅ ChartIndicatorAdd résultat: ", res, " err: ", GetLastError());
   }
   else
   {
      Print("❌ Impossible de créer le handle de ScannerMultiPairesSMC");
   }
}
