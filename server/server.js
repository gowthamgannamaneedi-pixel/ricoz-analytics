const app = require('./app');
const config = require('./config');
const db = require('./config/database');

const PORT = config.port;

// Initialize database schema and start server
db.initDb().finally(() => {
  app.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(` RicozAnalytics Server running on port ${PORT}`);
    console.log(` Health Check: http://localhost:${PORT}/api/health`);
    console.log(` Auth APIs:    http://localhost:${PORT}/api/auth/login`);
    console.log(` Environment:  ${config.nodeEnv}`);
    console.log(`===========================================`);
  });
});
