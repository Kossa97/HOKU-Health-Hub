package com.trackyourdose.app;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Health Connect verlangt eine Seite, die erklaert, wofuer die App
 * Gesundheitsdaten liest. Tippt jemand in den Health-Connect-Berechtigungen
 * auf den Datenschutz-Link, zeigt diese Activity die Datenschutzerklaerung
 * in der App. Die Seite waehlt Deutsch oder Englisch nach der Sprache des
 * Geraets.
 *
 * Eingebunden im AndroidManifest: direkt (Android 13 und frueher) und ueber
 * den activity-alias ViewPermissionUsageActivity (Android 14 und neuer).
 */
public class PermissionsRationaleActivity extends Activity {

    static final String PRIVACY_URL = "https://hokuhealth.app/datenschutz";

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        // Die Seite ist Teil der React-App und braucht JavaScript.
        web.getSettings().setJavaScriptEnabled(true);
        web.setWebViewClient(new WebViewClient());
        web.loadUrl(PRIVACY_URL);
        setContentView(web);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
