const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
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
  (async () => {
    try {
      await db.initDb();
    } catch (e) {
      console.warn(' initDb warning:', e.message);
    }

    // Explicitly guarantee last_active_at and invitations migrations are executed on startup
    try {
      await db.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
        CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at);
        CREATE TABLE IF NOT EXISTS invitations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          invited_by VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'viewer',
          token VARCHAR(255) UNIQUE NOT NULL,
          token_hash VARCHAR(255),
          expires_at TIMESTAMPTZ NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          accepted_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token_hash VARCHAR(255);
        ALTER TABLE invitations ADD COLUMN IF NOT EXISTS accepted_by VARCHAR(255);
        CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash);
      `);
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_org_pending_email ON invitations(organization_id, LOWER(email)) WHERE status = 'pending';
        CREATE INDEX IF NOT EXISTS idx_invitations_seat_calc ON invitations(organization_id, status, expires_at);
        CREATE INDEX IF NOT EXISTS idx_invitations_accepted_by ON invitations(accepted_by);
      `);

      // Explicitly guarantee Razorpay orders, webhook idempotency, and billing columns on startup
      await db.query(`
        ALTER TABLE organizations 
          ADD COLUMN IF NOT EXISTS razorpay_customer_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255);

        ALTER TABLE invoices
          ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS razorpay_invoice_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50) DEFAULT 'razorpay',
          ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(100);

        CREATE INDEX IF NOT EXISTS idx_invoices_razorpay_payment ON invoices(razorpay_payment_id);
        CREATE INDEX IF NOT EXISTS idx_invoices_razorpay_order ON invoices(razorpay_order_id);

        CREATE TABLE IF NOT EXISTS public.razorpay_orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id VARCHAR(255) NOT NULL,
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            user_id INTEGER,
            plan_id VARCHAR(50) NOT NULL,
            billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
            amount_paise BIGINT NOT NULL,
            currency VARCHAR(10) NOT NULL DEFAULT 'INR',
            status VARCHAR(50) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'attempted', 'paid', 'failed', 'cancelled')),
            payment_id VARCHAR(255),
            signature VARCHAR(255),
            receipt VARCHAR(100),
            notes JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_razorpay_orders_order_id'
            ) THEN
                ALTER TABLE public.razorpay_orders
                    ADD CONSTRAINT uq_razorpay_orders_order_id UNIQUE (order_id);
            END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_razorpay_orders_order_id ON public.razorpay_orders(order_id);
        CREATE INDEX IF NOT EXISTS idx_razorpay_orders_org_id ON public.razorpay_orders(organization_id);
        CREATE INDEX IF NOT EXISTS idx_razorpay_orders_payment_id ON public.razorpay_orders(payment_id);
        CREATE INDEX IF NOT EXISTS idx_razorpay_orders_status ON public.razorpay_orders(status);
        CREATE INDEX IF NOT EXISTS idx_razorpay_orders_created_at ON public.razorpay_orders(created_at DESC);

        CREATE TABLE IF NOT EXISTS public.razorpay_webhook_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id VARCHAR(255) NOT NULL,
            event_type VARCHAR(100) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
            organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
            payment_id VARCHAR(255),
            order_id VARCHAR(255),
            error_message TEXT,
            payload JSONB,
            processed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_razorpay_webhook_events_event_id'
            ) THEN
                ALTER TABLE public.razorpay_webhook_events
                    ADD CONSTRAINT uq_razorpay_webhook_events_event_id UNIQUE (event_id);
            END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_event_id ON public.razorpay_webhook_events(event_id);
        CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_event_type ON public.razorpay_webhook_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_org_id ON public.razorpay_webhook_events(organization_id);
        CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_status ON public.razorpay_webhook_events(status);
        CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_order_id ON public.razorpay_webhook_events(order_id);
        CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_payment_id ON public.razorpay_webhook_events(payment_id);
        CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_created_at ON public.razorpay_webhook_events(created_at DESC);

        -- Explicitly guarantee subscription history, reminders, and organization lifecycle columns on startup
        ALTER TABLE public.organizations
          ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(20) DEFAULT 'monthly',
          ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS cancellation_effective_date TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS scheduled_downgrade_plan VARCHAR(50),
          ADD COLUMN IF NOT EXISTS scheduled_downgrade_effective_date TIMESTAMPTZ;

        CREATE TABLE IF NOT EXISTS public.subscription_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
            event_type VARCHAR(50) NOT NULL,
            from_plan VARCHAR(50),
            to_plan VARCHAR(50),
            billing_interval VARCHAR(20),
            amount NUMERIC(10, 2),
            currency VARCHAR(10) DEFAULT 'inr',
            status VARCHAR(50) NOT NULL,
            effective_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_subscription_history_org ON public.subscription_history(organization_id);
        CREATE INDEX IF NOT EXISTS idx_subscription_history_created_at ON public.subscription_history(created_at DESC);

        CREATE TABLE IF NOT EXISTS public.subscription_reminders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
            reminder_type VARCHAR(50) NOT NULL,
            target_date DATE NOT NULL,
            recipient_email VARCHAR(255) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'sent',
            attempt_count INT NOT NULL DEFAULT 1,
            sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            error_message TEXT,
            metadata JSONB DEFAULT '{}'::jsonb
        );

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_sub_reminder'
            ) THEN
                ALTER TABLE public.subscription_reminders
                    ADD CONSTRAINT uq_sub_reminder UNIQUE (organization_id, reminder_type, target_date);
            END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_sub_reminders_org ON public.subscription_reminders(organization_id);
        CREATE INDEX IF NOT EXISTS idx_sub_reminders_target_date ON public.subscription_reminders(target_date);
      `);

      // Refresh account gowthamgannamaneedi01@gmail.com so it can register completely fresh as a brand new account
      await db.query(`
        DELETE FROM invitations WHERE LOWER(email) = 'gowthamgannamaneedi01@gmail.com';
        DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE LOWER(email) = 'gowthamgannamaneedi01@gmail.com');
        DELETE FROM users WHERE LOWER(email) = 'gowthamgannamaneedi01@gmail.com';
      `).catch(err => console.warn(' Account reset notice:', err.message));
    } catch (migErr) {
      console.warn(' Startup migration check notice:', migErr.message);
    }
  })().finally(() => {
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

      // Initialize durable demo email queue worker
      const demoEmailQueueService = require('./services/demoEmailQueueService');
      demoEmailQueueService.init().catch(err => {
        console.warn(' Demo email queue worker init warning:', err.message);
      });
    });

    // Configure enterprise upload timeouts (5 minutes request timeout for large 250MB+ datasets)
    if (server) {
      server.timeout = 300000;
      server.keepAliveTimeout = 65000;
      server.headersTimeout = 66000;
    }
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
