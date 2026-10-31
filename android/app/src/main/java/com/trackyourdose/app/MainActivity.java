package com.trackyourdose.app;

import android.content.Intent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Health Connect oeffnet die App ueber diese Aktionen, wenn jemand im
    // Berechtigungsdialog oder in den Einstellungen auf "Datenschutz" tippt.
    private static final String ACTION_RATIONALE = "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE";
    private static final String ACTION_PERMISSION_USAGE = "android.intent.action.VIEW_PERMISSION_USAGE";
    // Gleicher Wert wie HEALTH_SECTION_ID in src/features/compliance/legal/texts.ts
    private static final String PRIVACY_HEALTH_PATH = "/datenschutz#gesundheitsdaten";

    // BridgeActivity ruft onNewIntent auch beim Kaltstart (aus load()) auf.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (bridge == null || intent == null) return;
        String action = intent.getAction();
        if (ACTION_RATIONALE.equals(action) || ACTION_PERMISSION_USAGE.equals(action)) {
            String url = bridge.getLocalUrl() + PRIVACY_HEALTH_PATH;
            bridge.getWebView().post(() -> bridge.getWebView().loadUrl(url));
        }
    }
}
