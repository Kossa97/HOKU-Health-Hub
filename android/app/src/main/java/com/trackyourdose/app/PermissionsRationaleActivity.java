package com.trackyourdose.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/**
 * Health Connect verlangt eine Seite, die erklaert, wofuer die App
 * Gesundheitsdaten liest. Tippt jemand in den Health-Connect-Berechtigungen
 * auf den Datenschutz-Link, oeffnet diese Activity die Datenschutzerklaerung
 * im Browser und schliesst sich sofort wieder.
 *
 * Eingebunden im AndroidManifest: direkt (Android 13 und frueher) und ueber
 * den activity-alias ViewPermissionUsageActivity (Android 14 und neuer).
 */
public class PermissionsRationaleActivity extends Activity {

    static final String PRIVACY_URL = "https://hokuhealth.app/datenschutz";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(PRIVACY_URL));
        browser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(browser);
        } catch (ActivityNotFoundException ignored) {
            // Kein Browser installiert: nichts zu zeigen.
        }
        finish();
    }
}
