package com.laundrymate.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MainActivity extends BridgeActivity {

    private static final int LOCATION_PERMISSION_REQUEST_CODE = 1001;
    private static final int ALL_PERMISSIONS_REQUEST_CODE = 1002;
    private boolean bridgeInterfaceAdded = false;
    private boolean pendingNativeLocationRequest = false;
    private boolean openSettingsIfStillDenied = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private LocationListener activeLocationListener = null;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWebViewBridge();
        mainHandler.postDelayed(this::requestInitialPermissionsIfNeeded, 600);
    }

    @Override
    public void onStart() {
        super.onStart();
        configureWebViewBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebViewBridge();
        mainHandler.postDelayed(this::dispatchPermissionsStatusToWeb, 250);
    }

    @Override
    public void onDestroy() {
        stopActiveLocationUpdates();
        super.onDestroy();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebViewBridge() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setGeolocationEnabled(true);
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        if (!bridgeInterfaceAdded) {
            webView.addJavascriptInterface(new AndroidPermissionBridge(), "LaundryMateAndroid");
            bridgeInterfaceAdded = true;
        }
    }

    private boolean isLocationGranted() {
        boolean fine =
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED;
        boolean coarse =
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED;
        return fine || coarse;
    }

    private boolean isFilesGranted() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return (
                ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) ==
                PackageManager.PERMISSION_GRANTED
            );
        }
        return (
            ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) ==
            PackageManager.PERMISSION_GRANTED
        );
    }

    private boolean isCameraGranted() {
        return (
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        );
    }

    private boolean isNotificationsGranted() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return (
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
            );
        }
        return true;
    }

    private List<String> collectMissingPermissions() {
        List<String> needed = new ArrayList<>();
        if (!isLocationGranted()) {
            needed.add(Manifest.permission.ACCESS_FINE_LOCATION);
            needed.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (!isCameraGranted()) {
            needed.add(Manifest.permission.CAMERA);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (
                ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                needed.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
            if (
                ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VIDEO) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                needed.add(Manifest.permission.READ_MEDIA_VIDEO);
            }
            if (
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                needed.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        } else {
            if (
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.READ_EXTERNAL_STORAGE
                ) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                needed.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
            if (
                Build.VERSION.SDK_INT <= Build.VERSION_CODES.Q &&
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE
                ) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                needed.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
        }
        return needed;
    }

    private String buildPermissionsStatusJson() {
        return String.format(
            Locale.US,
            "{\"location\":%s,\"files\":%s,\"camera\":%s,\"notifications\":%s,\"allGranted\":%s}",
            isLocationGranted() ? "true" : "false",
            isFilesGranted() ? "true" : "false",
            isCameraGranted() ? "true" : "false",
            isNotificationsGranted() ? "true" : "false",
            (isLocationGranted() && isFilesGranted() && isCameraGranted() && isNotificationsGranted())
                ? "true"
                : "false"
        );
    }

    private void dispatchPermissionsStatusToWeb() {
        evalJs(
            "window.dispatchEvent(new CustomEvent('laundrymatePermissionsStatus', { detail: " +
            buildPermissionsStatusJson() +
            " }));"
        );
    }

    private void requestInitialPermissionsIfNeeded() {
        if (isFinishing() || isDestroyed()) {
            return;
        }
        List<String> needed = collectMissingPermissions();
        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                needed.toArray(new String[0]),
                ALL_PERMISSIONS_REQUEST_CODE
            );
        } else {
            dispatchPermissionsStatusToWeb();
        }
    }

    private void evalJs(final String script) {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }
        final WebView webView = getBridge().getWebView();
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void dispatchLocationToWeb(Location location) {
        if (location == null) {
            return;
        }
        String js = String.format(
            Locale.US,
            "window.dispatchEvent(new CustomEvent('laundrymateNativeLocation', { detail: { latitude: %.7f, longitude: %.7f, accuracy: %.2f } }));",
            location.getLatitude(),
            location.getLongitude(),
            location.getAccuracy()
        );
        evalJs(js);
    }

    private void dispatchLocationErrorToWeb(int code, String message) {
        String safeMessage = message == null ? "" : message.replace("'", "\\'");
        String js = String.format(
            Locale.US,
            "window.dispatchEvent(new CustomEvent('laundrymateNativeLocationError', { detail: { code: %d, message: '%s' } }));",
            code,
            safeMessage
        );
        evalJs(js);
    }

    private void stopActiveLocationUpdates() {
        if (activeLocationListener != null) {
            try {
                LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                if (lm != null) {
                    lm.removeUpdates(activeLocationListener);
                }
            } catch (Exception ignored) {}
            activeLocationListener = null;
        }
    }

    @SuppressLint("MissingPermission")
    private void fetchAndSendNativeLocation() {
        if (!isLocationGranted()) {
            dispatchLocationErrorToWeb(1, "Location permission was denied.");
            return;
        }

        LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) {
            dispatchLocationErrorToWeb(2, "Location service is unavailable.");
            return;
        }

        boolean gpsEnabled = false;
        boolean networkEnabled = false;
        try {
            gpsEnabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
        } catch (Exception ignored) {}
        try {
            networkEnabled = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception ignored) {}

        if (!gpsEnabled && !networkEnabled) {
            dispatchLocationErrorToWeb(2, "Device Location (GPS) is turned off.");
            return;
        }

        Location bestLastKnown = null;
        String[] providers = new String[] {
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        };

        for (String provider : providers) {
            try {
                Location candidate = lm.getLastKnownLocation(provider);
                if (candidate != null) {
                    if (
                        bestLastKnown == null ||
                        candidate.getTime() > bestLastKnown.getTime()
                    ) {
                        bestLastKnown = candidate;
                    }
                }
            } catch (Exception ignored) {}
        }

        if (bestLastKnown != null) {
            dispatchLocationToWeb(bestLastKnown);
        }

        stopActiveLocationUpdates();

        final boolean hadInitialFix = bestLastKnown != null;
        activeLocationListener = new LocationListener() {
            @Override
            public void onLocationChanged(@NonNull Location location) {
                dispatchLocationToWeb(location);
                if (location.getAccuracy() <= 60f) {
                    stopActiveLocationUpdates();
                }
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {}

            @Override
            public void onProviderEnabled(@NonNull String provider) {}

            @Override
            public void onProviderDisabled(@NonNull String provider) {}
        };

        try {
            if (networkEnabled) {
                lm.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    0L,
                    0f,
                    activeLocationListener,
                    Looper.getMainLooper()
                );
            }
            if (gpsEnabled) {
                lm.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    0L,
                    0f,
                    activeLocationListener,
                    Looper.getMainLooper()
                );
            }
        } catch (Exception e) {
            if (!hadInitialFix) {
                dispatchLocationErrorToWeb(2, "Unable to request device location.");
            }
        }

        mainHandler.postDelayed(() -> {
            stopActiveLocationUpdates();
        }, 10000);
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        @NonNull String[] permissions,
        @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        dispatchPermissionsStatusToWeb();
        if (
            requestCode == LOCATION_PERMISSION_REQUEST_CODE ||
            requestCode == ALL_PERMISSIONS_REQUEST_CODE
        ) {
            final boolean granted = isLocationGranted();
            evalJs(
                "window.dispatchEvent(new CustomEvent('laundrymateLocationPermissionResult', { detail: { granted: " +
                (granted ? "true" : "false") +
                " } }));"
            );
            if (pendingNativeLocationRequest) {
                pendingNativeLocationRequest = false;
                if (granted) {
                    fetchAndSendNativeLocation();
                } else {
                    dispatchLocationErrorToWeb(1, "Location permission was denied.");
                }
            }
            if (openSettingsIfStillDenied) {
                openSettingsIfStillDenied = false;
                if (!collectMissingPermissions().isEmpty()) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                        Uri uri = Uri.fromParts("package", getPackageName(), null);
                        intent.setData(uri);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception ignored) {}
                }
            }
        }
    }

    public class AndroidPermissionBridge {

        @JavascriptInterface
        public boolean hasLocationPermission() {
            return isLocationGranted();
        }

        @JavascriptInterface
        public boolean hasAllPermissions() {
            return collectMissingPermissions().isEmpty();
        }

        @JavascriptInterface
        public String getPermissionsStatus() {
            return buildPermissionsStatusJson();
        }

        @JavascriptInterface
        public void requestAllPermissions() {
            runOnUiThread(() -> {
                List<String> needed = collectMissingPermissions();
                if (needed.isEmpty()) {
                    dispatchPermissionsStatusToWeb();
                    return;
                }
                openSettingsIfStillDenied = true;
                ActivityCompat.requestPermissions(
                    MainActivity.this,
                    needed.toArray(new String[0]),
                    ALL_PERMISSIONS_REQUEST_CODE
                );
            });
        }

        @JavascriptInterface
        public void requestLocationPermission() {
            runOnUiThread(() -> {
                if (isLocationGranted()) {
                    evalJs(
                        "window.dispatchEvent(new CustomEvent('laundrymateLocationPermissionResult', { detail: { granted: true } }));"
                    );
                    return;
                }
                ActivityCompat.requestPermissions(
                    MainActivity.this,
                    new String[] {
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    },
                    LOCATION_PERMISSION_REQUEST_CODE
                );
            });
        }

        @JavascriptInterface
        public void requestCurrentLocation() {
            runOnUiThread(() -> {
                if (isLocationGranted()) {
                    fetchAndSendNativeLocation();
                    return;
                }
                pendingNativeLocationRequest = true;
                ActivityCompat.requestPermissions(
                    MainActivity.this,
                    new String[] {
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    },
                    LOCATION_PERMISSION_REQUEST_CODE
                );
            });
        }

        @JavascriptInterface
        public void openAppSettings() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    Uri uri = Uri.fromParts("package", getPackageName(), null);
                    intent.setData(uri);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception e) {
                    Intent fallback = new Intent(Settings.ACTION_SETTINGS);
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(fallback);
                }
            });
        }

        @JavascriptInterface
        public void openLocationSettings() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception e) {
                    openAppSettings();
                }
            });
        }
    }
}
