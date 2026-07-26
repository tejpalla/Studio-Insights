-- Helix arena — Unity Catalog volume setup
-- Run once in Databricks SQL Editor

CREATE VOLUME IF NOT EXISTS workspace.default.helix_arena;

-- After Helix syncs a run (or you upload CSVs under helix-arena/<runId>/),
-- the heat notebook creates:
--   workspace.default.helix_arena_posts
--   workspace.default.helix_arena_comments
--   workspace.default.helix_arena_agents
--   workspace.default.helix_arena_events
--   workspace.default.helix_arena_heat_clusters
--   workspace.default.helix_arena_reply_storms

-- SELECT * FROM workspace.default.helix_arena_reply_storms ORDER BY comment_n DESC LIMIT 20;
