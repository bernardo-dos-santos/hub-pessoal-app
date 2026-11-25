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
      // start.js, not index.js: it turns a failed boot into an exit PM2 can
      // retry — see the comment there.
      script: 'server/start.js',
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
  ],
};
