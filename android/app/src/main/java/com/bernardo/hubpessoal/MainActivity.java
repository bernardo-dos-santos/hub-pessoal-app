package com.bernardo.hubpessoal;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Antes do super: é lá dentro que a bridge é montada, e um plugin
        // registrado depois disso não existe para o JS.
        registerPlugin(ShareTargetPlugin.class);
        super.onCreate(savedInstanceState);
        handleShare(getIntent());
    }

    /**
     * A Activity é `singleTask`: com o app já aberto, compartilhar NÃO cria uma
     * instância nova — o Intent chega por aqui. Sem este override, o
     * compartilhamento só funcionaria com o app fechado.
     */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShare(intent);
    }

    private void handleShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;

        String type = intent.getType();
        if (type == null || !type.startsWith("text/")) return;

        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.trim().isEmpty()) return;

        // EXTRA_SUBJECT costuma trazer o título da página quando o
        // compartilhamento vem do navegador; noutros apps vem vazio.
        ShareTargetPlugin.deliver(text, intent.getStringExtra(Intent.EXTRA_SUBJECT));
    }
}
