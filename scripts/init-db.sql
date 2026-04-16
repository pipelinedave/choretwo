-- Initialize choretwo database schemas
-- This script runs on first startup

-- Create schemas if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_namespace WHERE nspname = 'auth') THEN
        EXECUTE 'CREATE SCHEMA auth';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_namespace WHERE nspname = 'chores') THEN
        EXECUTE 'CREATE SCHEMA chores';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_namespace WHERE nspname = 'logs') THEN
        EXECUTE 'CREATE SCHEMA logs';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_namespace WHERE nspname = 'notifications') THEN
        EXECUTE 'CREATE SCHEMA notifications';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_namespace WHERE nspname = 'ai') THEN
        EXECUTE 'CREATE SCHEMA ai';
    END IF;
END
$$;

-- Grant privileges
GRANT ALL PRIVILEGES ON SCHEMA auth TO choretwo;
GRANT ALL PRIVILEGES ON SCHEMA chores TO choretwo;
GRANT ALL PRIVILEGES ON SCHEMA logs TO choretwo;
GRANT ALL PRIVILEGES ON SCHEMA notifications TO choretwo;
GRANT ALL PRIVILEGES ON SCHEMA ai TO choretwo;

-- Create auth schema tables
SET search_path TO auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON auth.users(email);

-- Create chores schema tables
SET search_path TO chores;

CREATE TABLE IF NOT EXISTS chores.chores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    interval_days INT NOT NULL DEFAULT 1,
    due_date DATE NOT NULL,
    done BOOLEAN DEFAULT FALSE,
    done_by VARCHAR(255),
    last_done DATE,
    owner_email VARCHAR(255),
    is_private BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chores_owner ON chores.chores(owner_email);
CREATE INDEX IF NOT EXISTS idx_chores_archived ON chores.chores(archived);
CREATE INDEX IF NOT EXISTS idx_chores_done ON chores.chores(done);

-- Create logs schema tables
SET search_path TO logs;

CREATE TABLE IF NOT EXISTS logs.chore_logs (
    id SERIAL PRIMARY KEY,
    chore_id INT,
    done_by VARCHAR(255),
    done_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action_type VARCHAR(50) NOT NULL,
    action_details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chore_logs_chore_id ON logs.chore_logs(chore_id);
CREATE INDEX IF NOT EXISTS idx_chore_logs_done_by ON logs.chore_logs(done_by);
CREATE INDEX IF NOT EXISTS idx_chore_logs_action_type ON logs.chore_logs(action_type);

-- Create notifications schema tables
SET search_path TO notifications;

CREATE TABLE IF NOT EXISTS notifications.notification_preferences (
    user_email VARCHAR(255) PRIMARY KEY,
    enabled BOOLEAN DEFAULT TRUE,
    notify_times JSONB DEFAULT '["09:00", "18:00"]'::jsonb,
    notify_overdue BOOLEAN DEFAULT TRUE,
    notify_soon BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications.scheduled_notifications (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255),
    chore_id INT,
    scheduled_for TIMESTAMP,
    sent_at TIMESTAMP,
    notification_type VARCHAR(50),
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user ON notifications.scheduled_notifications(user_email);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_for ON notifications.scheduled_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_processed ON notifications.scheduled_notifications(processed);

-- Create ai schema tables (if needed)
SET search_path TO ai;

CREATE TABLE IF NOT EXISTS ai.user_preferences (
    user_email VARCHAR(255) PRIMARY KEY,
    learning_enabled BOOLEAN DEFAULT TRUE,
    suggestion_types JSONB DEFAULT '["recurrence", "timing", "assignment"]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reset search path
RESET search_path;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Choretwo database schemas initialized successfully';
END $$;
