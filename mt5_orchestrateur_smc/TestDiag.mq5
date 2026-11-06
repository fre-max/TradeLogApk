//+------------------------------------------------------------------+
//|                                                   TestDiag.mq5   |
//+------------------------------------------------------------------+
#property copyright "Test"
#property version   "1.00"
#property script_show_inputs

void OnStart()
{
   ResetLastError();
   bool resEur = SymbolSelect("EURUSD", true);
   int errEur = GetLastError();
   PrintFormat(">>> Test EURUSD: res=%s, err=%d, bid=%f", (resEur ? "true" : "false"), errEur, SymbolInfoDouble("EURUSD", SYMBOL_BID));

   ResetLastError();
   bool resSelf = SymbolSelect(_Symbol, true);
   int errSelf = GetLastError();
   PrintFormat(">>> Test _Symbol (%s): res=%s, err=%d, bid=%f", _Symbol, (resSelf ? "true" : "false"), errSelf, SymbolInfoDouble(_Symbol, SYMBOL_BID));

   int totalMW = SymbolsTotal(true);
   int totalAll = SymbolsTotal(false);
   PrintFormat(">>> Total MarketWatch=%d, Total Broker All=%d", totalMW, totalAll);

   for(int i = 0; i < totalMW; i++)
   {
      string s = SymbolName(i, true);
      PrintFormat(">>> MW[%d] = %s (TradeMode=%d)", i, s, (int)SymbolInfoInteger(s, SYMBOL_TRADE_MODE));
   }
}

