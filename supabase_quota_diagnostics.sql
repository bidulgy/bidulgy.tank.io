-- Read-only diagnostics for Supabase SQL Editor.
-- This script does not delete or alter data.

select pg_size_pretty(pg_database_size(current_database())) as database_size;

select
  schemaname,
  relname as relation_name,
  pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, relname))) as total_size,
  pg_total_relation_size(format('%I.%I', schemaname, relname)) as total_bytes
from pg_stat_user_tables
order by total_bytes desc
limit 30;

select
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  pg_relation_size(indexrelid) as index_bytes
from pg_stat_user_indexes
order by index_bytes desc
limit 30;

select
  schemaname,
  relname as table_name,
  n_live_tup as estimated_live_rows,
  n_dead_tup as estimated_dead_rows,
  last_autovacuum,
  last_autoanalyze
from pg_stat_user_tables
order by n_dead_tup desc
limit 30;
