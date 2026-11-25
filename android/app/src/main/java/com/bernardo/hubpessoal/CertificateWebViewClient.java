package com.bernardo.hubpessoal;

import android.webkit.ClientCertRequest;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Capacitor's WebView client plus the one thing it doesn't do: answer a
 * server's request for a client certificate (the Olimpo's public address,
 * Cloudflare mTLS). Without it the WebView cancels the request and Cloudflare
 * blocks every page asset. See ClientCertificates.
 */
class CertificateWebViewClient extends BridgeWebViewClient {

    CertificateWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public void onReceivedClientCertRequest(WebView view, ClientCertRequest request) {
        ClientCertificates.answer(request);
    }
}
