package com.bernardo.hubpessoal;

import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.pm.PackageInfoCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Self-update of the APK, published on the Hub server (npm run apk:release).
 *
 * Written by hand like ShareTargetPlugin: tell JS which version is installed,
 * download the new APK into the app's cache, check its SHA-256 against what the
 * server announced, and install it through a PackageInstaller session.
 *
 * The session (instead of an ACTION_VIEW intent) is what makes updates
 * automatic: on Android 12+ an app that is the "installer of record" of itself
 * may update itself without asking (USER_ACTION_NOT_REQUIRED). The first update
 * still shows Android's confirmation — the APK was installed by the file
 * manager then — and makes the Hub its own installer from there on.
 * InstallStatusReceiver gets the outcome.
 *
 * Updates only install over an APK signed with the same key — the notebook's
 * debug keystore today, so builds must keep coming from that machine.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject result = new JSObject();
            result.put("versionCode", PackageInfoCompat.getLongVersionCode(info));
            result.put("versionName", info.versionName);
            call.resolve(result);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    /** Android 8+ asks, once per app, for permission to install other apps. */
    @PluginMethod
    public void canInstall(PluginCall call) {
        boolean allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject result = new JSObject();
        result.put("allowed", allowed);
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /**
     * Downloads `url` to the cache, verifies `sha256` and opens the installer.
     * Emits "progress" events ({ percent }) while downloading.
     */
    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String expectedSha256 = call.getString("sha256");
        if (url == null || expectedSha256 == null) {
            call.reject("url e sha256 são obrigatórios.");
            return;
        }
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("Não consegui criar a pasta de download.");
                File apk = new File(dir, "hub-update.apk");

                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(60000);
                if (connection.getResponseCode() != 200) throw new Exception("Servidor respondeu " + connection.getResponseCode());
                long total = connection.getContentLengthLong();

                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buffer = new byte[64 * 1024];
                    long done = 0;
                    int lastPercent = -1;
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        digest.update(buffer, 0, read);
                        done += read;
                        if (total > 0) {
                            int percent = (int) (done * 100 / total);
                            if (percent != lastPercent) {
                                lastPercent = percent;
                                JSObject progress = new JSObject();
                                progress.put("percent", percent);
                                notifyListeners("progress", progress);
                            }
                        }
                    }
                }

                StringBuilder hex = new StringBuilder();
                for (byte b : digest.digest()) hex.append(String.format("%02x", b));
                if (!hex.toString().equalsIgnoreCase(expectedSha256)) {
                    //noinspection ResultOfMethodCallIgnored
                    apk.delete();
                    throw new Exception("O arquivo baixado não confere com o publicado (SHA-256). Tente de novo.");
                }

                installViaSession(apk);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    private void installViaSession(File apk) throws Exception {
        PackageInstaller installer = getContext().getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(getContext().getPackageName());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        }
        int sessionId = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(sessionId)) {
            try (InputStream in = new FileInputStream(apk); OutputStream out = session.openWrite("hub.apk", 0, apk.length())) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
                session.fsync(out);
            }
            Intent status = new Intent(getContext(), InstallStatusReceiver.class);
            // MUTABLE: the system writes the install status into this intent.
            PendingIntent callback = PendingIntent.getBroadcast(getContext(), sessionId, status,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
            session.commit(callback.getIntentSender());
        }
    }
}
