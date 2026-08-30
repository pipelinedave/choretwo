DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'choretwo') THEN
        CREATE ROLE choretwo WITH LOGIN PASSWORD 'choretwo_dev' SUPERUSER;
    END IF;
END $$;

SELECT 'CREATE DATABASE choretwo OWNER choretwo'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'choretwo')\gexec

\c choretwo

CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION choretwo;
CREATE SCHEMA IF NOT EXISTS chores AUTHORIZATION choretwo;
CREATE SCHEMA IF NOT EXISTS logs AUTHORIZATION choretwo;
CREATE SCHEMA IF NOT EXISTS notifications AUTHORIZATION choretwo;
CREATE SCHEMA IF NOT EXISTS ai AUTHORIZATION choretwo;

GRANT ALL ON SCHEMA auth TO choretwo;
GRANT ALL ON SCHEMA chores TO choretwo;
GRANT ALL ON SCHEMA logs TO choretwo;
GRANT ALL ON SCHEMA notifications TO choretwo;
GRANT ALL ON SCHEMA ai TO choretwo;
