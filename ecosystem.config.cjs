/**
 * ecosystem.config.cjs — Configuração do PM2 para o Hub Pessoal.
 *
 * Iniciar:    pm2 start ecosystem.config.cjs
 * Parar:      pm2 stop hub-server
 * Reiniciar:  pm2 restart hub-server
 * Logs:       pm2 logs hub-server
 * Status:     pm2 status
 */

module.exports = {
  apps: [
    {
      name: 'hub-server',
      script: 'server/index.js',
      // __dirname (não um caminho absoluto fixo) — o mesmo arquivo funciona
      // sem edição em qualquer máquina (notebook ou o PC dedicado), e fica
      // seguro pra versionar: um `git pull` nunca mais grava o caminho da
      // máquina errada por cima. Bug real: isso já aconteceu — o dedicado
      // rodava com `cwd` do notebook, `--env-file=.env` resolvia num
      // caminho que não existe ali, hub-server entrava em crash-loop e o
      // deploy ficava "concluído" sem o servidor no ar.
      cwd: __dirname,
      node_args: '--env-file=.env',

      // Reinicia automaticamente se o processo travar/crashar
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,

      // Logs em arquivo (pm2 logs hub-server para acompanhar)
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // Modo fork (não cluster) — servidor single-thread
      exec_mode: 'fork',
      instances: 1,
    },
    // O `pluggy-webhook` foi removido daqui de propósito (2026-08-02).
    //
    // Ele recebia o aviso da Pluggy sobre transação nova, mas nunca passou de
    // registrar o evento no log — nada no Hub reagia a ele. Enquanto isso, era
    // a única porta do PC dedicado aberta pra internet pública, e ficou em
    // crash-loop por dias depois que um processo órfão tomou a porta 3055.
    // Manter exposto um serviço que não faz trabalho nenhum só somava risco.
    //
    // A coleta não depende dele: quem traz as transações é o
    // `scripts/sync/pluggy-sync.js` (tarefa HubPessoal-PluggySync-Daily).
    //
    // Pra reativar, quando houver o que fazer com o evento: devolver este bloco
    // e religar o Funnel (`tailscale funnel --https=8443 on`). O servidor
    // continua em `server/pluggyWebhookServer.js`. Precisa voltar aqui, e não
    // só um `pm2 start` avulso: o AutoDeploy roda `pm2 startOrRestart
    // ecosystem.config.cjs`, então este arquivo é a fonte da verdade do que
    // fica de pé.
  ],
};
