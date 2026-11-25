package com.bernardo.hubpessoal;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.security.KeyChain;
import android.security.KeyChainException;
import android.util.Log;
import android.webkit.ClientCertRequest;

import java.net.Socket;
import java.security.Principal;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.concurrent.Executors;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.KeyManager;
import javax.net.ssl.SSLContext;
import javax.net.ssl.X509KeyManager;

/**
 * The device certificate the Olimpo's public address asks for (F4: Cloudflare
 * mTLS — without it Cloudflare blocks the request before it reaches the server).
 *
 * The certificate lives in Android's own store (Settings → Encryption &
 * credentials → install a "VPN & app user certificate"); the app never holds a
 * copy. The first time, Android shows its "choose a certificate" dialog; the
 * alias picked is remembered and Android keeps granting the app that key.
 *
 * Two network stacks need it, so it's handed to both:
 * - the WebView's (page assets) through onReceivedClientCertRequest, in
 *   CertificateWebViewClient;
 * - HttpsURLConnection's, which Capacitor uses for the page's HTML (it fetches
 *   it itself to inject the bridge) and for every fetch() (CapacitorHttp), and
 *   AppUpdatePlugin for the APK download: a process-wide default socket factory.
 *   Its key manager is only asked when a server requests a client certificate,
 *   so the Tailscale address and everything else are unaffected.
 */
final class ClientCertificates {

    private static final String TAG = "OlimpoCert";
    private static final String PREFS = "olimpo_client_cert";
    private static final String KEY_ALIAS = "alias";

    private static Context appContext;

    private ClientCertificates() {}

    static String alias() {
        return appContext == null ? null : prefs(appContext).getString(KEY_ALIAS, null);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Installs the default socket factory. Call once, before the first request. */
    static void install(Context context) {
        appContext = context.getApplicationContext();
        try {
            SSLContext tls = SSLContext.getInstance("TLS");
            tls.init(new KeyManager[] { new ChainKeyManager() }, null, null);
            HttpsURLConnection.setDefaultSSLSocketFactory(tls.getSocketFactory());
        } catch (Exception e) {
            Log.e(TAG, "Não deu para preparar o certificado do aparelho", e);
        }
    }

    /**
     * Makes sure an alias is chosen; asks Android when none is (or the one we
     * had was removed). `onChosen` runs, off the UI thread, only when a new
     * alias was picked — the caller reloads the page with it.
     */
    static void ensureChosen(Activity activity, String host, Runnable onChosen) {
        Executors.newSingleThreadExecutor().execute(() -> {
            String current = alias();
            if (current != null && key(current) != null) return;
            KeyChain.choosePrivateKeyAlias(activity, chosen -> {
                if (chosen == null) return; // the person cancelled: the page shows Cloudflare's block
                prefs(activity).edit().putString(KEY_ALIAS, chosen).apply();
                // A fresh socket factory: HttpsURLConnection pools connections by
                // factory, and the ones opened before (without a certificate)
                // must not be reused — Cloudflare checks it per handshake.
                install(activity);
                onChosen.run();
            }, new String[] { "RSA", "EC" }, null, host, 443, current);
        });
    }

    /**
     * Answers the WebView's certificate request, off the UI thread (KeyChain
     * blocks). Without a key it's ignore(), never cancel(): the WebView
     * remembers a cancel for that host until the app closes, so the request
     * that races the first-run dialog would keep every later one certificate-less.
     */
    static void answer(ClientCertRequest request) {
        Executors.newSingleThreadExecutor().execute(() -> {
            String alias = alias();
            PrivateKey key = alias == null ? null : key(alias);
            X509Certificate[] chain = alias == null ? null : chain(alias);
            if (key != null && chain != null) request.proceed(key, chain);
            else request.ignore();
        });
    }

    private static PrivateKey key(String alias) {
        try {
            return KeyChain.getPrivateKey(appContext, alias);
        } catch (KeyChainException | InterruptedException e) {
            Log.w(TAG, "Certificado " + alias + " indisponível", e);
            return null;
        }
    }

    private static X509Certificate[] chain(String alias) {
        try {
            return KeyChain.getCertificateChain(appContext, alias);
        } catch (KeyChainException | InterruptedException e) {
            Log.w(TAG, "Cadeia do certificado " + alias + " indisponível", e);
            return null;
        }
    }

    /** Hands HttpsURLConnection the chosen key; called on network threads, never the UI's. */
    private static final class ChainKeyManager implements X509KeyManager {
        @Override
        public String chooseClientAlias(String[] keyType, Principal[] issuers, Socket socket) {
            return alias();
        }

        @Override
        public X509Certificate[] getCertificateChain(String alias) {
            return chain(alias);
        }

        @Override
        public PrivateKey getPrivateKey(String alias) {
            return key(alias);
        }

        @Override
        public String[] getClientAliases(String keyType, Principal[] issuers) {
            String alias = alias();
            return alias == null ? null : new String[] { alias };
        }

        @Override
        public String chooseServerAlias(String keyType, Principal[] issuers, Socket socket) {
            return null;
        }

        @Override
        public String[] getServerAliases(String keyType, Principal[] issuers) {
            return null;
        }
    }
}
