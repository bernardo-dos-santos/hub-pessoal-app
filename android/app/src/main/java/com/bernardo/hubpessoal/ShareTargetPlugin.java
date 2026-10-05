package com.bernardo.hubpessoal;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ponte do "Compartilhar → Hub Pessoal" (Fase 13).
 *
 * Plugin escrito à mão em vez de um da comunidade de propósito: são ~40 linhas
 * contra uma dependência a mais para manter em dia a cada versão do Capacitor,
 * e o que ela faria é exatamente isto.
 *
 * O texto compartilhado fica num campo estático porque a Activity recebe o
 * Intent ANTES de a WebView existir (app fechado, aberto pelo menu de
 * compartilhamento). Guardar e deixar o JS buscar quando estiver pronto é o que
 * evita perder o conteúdo nesse caso — que é justamente o caso mais comum.
 *
 * Não há evento empurrado para o JS: o lado web consulta ao montar e sempre que
 * a aba volta a ficar visível. Com o app já aberto em segundo plano, o Android
 * traz a Activity para frente ao compartilhar, o que dispara visibilitychange —
 * então a consulta cobre os dois caminhos sem risco de entregar duas vezes.
 */
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {

    private static String pendingText;
    private static String pendingSubject;

    /** Chamado pela MainActivity quando um ACTION_SEND de texto chega. */
    static void deliver(String text, String subject) {
        pendingText = text;
        pendingSubject = subject;
    }

    /**
     * Devolve o que estiver pendente e LIMPA. Consumir de uma vez é o que
     * impede o mesmo link de reaparecer no chat toda vez que o app volta do
     * segundo plano.
     */
    @PluginMethod
    public void consumePending(PluginCall call) {
        JSObject data = new JSObject();
        data.put("text", pendingText);
        data.put("subject", pendingSubject);
        pendingText = null;
        pendingSubject = null;
        call.resolve(data);
    }
}
