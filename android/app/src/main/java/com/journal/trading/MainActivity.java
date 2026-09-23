package com.journal.trading;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            // Force le vidage du cache de la WebView au démarrage
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().clearCache(true);
            }
        } catch (Exception e) {
            // Ignorer si la WebView n'est pas encore initialisée
        }
    }
}
