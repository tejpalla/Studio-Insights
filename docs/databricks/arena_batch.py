# Helix × Databricks — batch arena jobs outline
# Fan out many scripts through the same export schema as a live Helix run.

"""
for each script in catalog.scripts:
  state = create_arena(script)
  run_arena(state, generate_json)
  write events / posts / comments → UC volume or Delta

Then:
  Autoloader → helix_arena_events
  TF-IDF / embeddings → heat clusters
  per-series scorecard (reply storms, leave signals, archetype mix)
"""

SCHEMA = {
    "arena_runs": ["run_id", "series_id", "series_title", "agent_count", "rounds", "finished_at"],
    "arena_events": ["run_id", "event_type", "ts", "round", "agent_id", "username", "action", "post_id"],
    "posts": ["run_id", "post_id", "kind", "title", "author", "vibe", "about_episode"],
    "comments": ["run_id", "comment_id", "post_id", "author", "body", "vibe"],
}
