SELECT 'CREATE DATABASE opencloning_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'opencloning_test')
\gexec

SELECT 'CREATE DATABASE opencloning_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'opencloning_e2e')
\gexec

SELECT 'CREATE DATABASE opencloning_test_readonly'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'opencloning_test_readonly')
\gexec
