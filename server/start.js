// server/start.js — what PM2 runs (ecosystem.config.cjs), instead of index.js.
//
// PM2 loads an ES module with a bare `import()` and injects its own
// unhandledRejection listener, which logs and carries on. So when the boot
// throws (a SQLite lock in db.js, on 2026-11-16), the process stays "online"
// without ever opening the port, and nothing restarts it. Exiting here makes a
// failed boot a crash that PM2 retries.
import('./index.js').catch((err) => {
  console.error('[server] boot falhou:', err);
  process.exit(1);
});
