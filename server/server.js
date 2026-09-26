const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const schedulerService = require('./services/schedulerService');
const { validateEnvironment } = require('./utils/envValidator');

const PORT = config.port;

// 1. Validate Environment on Startup
const envReport = validateEnvironment();
if (!envReport.isValid) {
  console.error(' [Startup Error] Environment validation failed:');
  envReport.errors.forEach(err => console.error(`   - ${err}`));
  if (config.nodeEnv === 'production') {
    process.exit(1);
  }
} else if (envReport.warnings.length > 0 && config.nodeEnv !== 'test') {
  console.log(' [Config Notice]');
  envReport.warnings.forEach(w => console.log(`   - ${w}`));
}

// 2. Initialize database schema and start server
let server;

if (require.main === module) {
  db.initDb().finally(() => {
    server = app.listen(PORT, () => {
      console.log(`===========================================`);
      console.log(` RicozAnalytics Server running on port ${PORT}`);
      console.log(` Health Check: http://localhost:${PORT}/api/health`);
      console.log(` Readiness:    http://localhost:${PORT}/api/ready`);
      console.log(` Auth APIs:    http://localhost:${PORT}/api/auth/login`);
      console.log(` Environment:  ${config.nodeEnv}`);
      console.log(`===========================================`);

      // Start background report & alert scheduler
      schedulerService.start();
    });
  });
}

// 3. Graceful Shutdown Handler
let isShuttingDown = false;

async function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      console.log(' HTTP server closed cleanly.');
    });
  }

  // Stop background scheduler tasks
  try {
    schedulerService.stop();
  } catch (err) {
    console.warn(' Scheduler stop error:', err.message);
  }

  // Drain database connection pool
  try {
    await db.closeDb();
  } catch (err) {
    console.warn(' Database drain error:', err.message);
  }

  console.log(' Graceful shutdown complete. Exiting.');
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

module.exports = {
  getServer: () => server,
  handleShutdown
};
