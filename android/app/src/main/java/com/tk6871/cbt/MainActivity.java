package com.tk6871.cbt;

import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void load() {
        // Every APK serves its own modules at the same WebView origin.
        // Drop cached responses before Capacitor requests the new entry page.
        WebView webView = findViewById(com.getcapacitor.android.R.id.webview);
        if (webView != null) {
            SharedPreferences state = getSharedPreferences("web_bundle", MODE_PRIVATE);
            try {
                long installedAt = getPackageManager().getPackageInfo(getPackageName(), 0).lastUpdateTime;
                if (state.getLong("installed_at", -1L) != installedAt) {
                    webView.clearCache(true);
                    state.edit().putLong("installed_at", installedAt).apply();
                }
            } catch (PackageManager.NameNotFoundException ignored) {
                // Continue booting if the package manager cannot report this installation.
            }
        }
        super.load();
    }
}
