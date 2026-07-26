# Databricks arena batch stub (conceptual)
# Not executed in the hackathon demo — see docs/DATABRICKS_SCALE.md

"""
Outline for a Jobs notebook that scales Helix's redditArena:

1. Read scripts from a Delta table or volume (100+ serials).
2. For each script, run create_arena + run_arena (or HTTP POST /api/arena/run).
3. Append arena_events JSONL into Delta; snapshot posts/comments.
4. Embed comment bodies; cluster heat; write per-script scorecard.

Pseudo:

from pyspark.sql import functions as F

scripts = spark.table("helix.scripts")
# foreachPartition / pandas UDF calling arena worker
# events_df = spark.read.json("/Volumes/.../arena-runs/*.jsonl")
# embeddings = ai_query("databricks-gte-large-en", F.col("summary"))
# clusters = ...
"""

SCHEMA = {
    "arena_runs": ["run_id", "series_id", "series_title", "agent_count", "rounds", "finished_at"],
    "arena_events": ["run_id", "event_type", "ts", "round", "agent_id", "username", "action", "post_id"],
    "posts": ["run_id", "post_id", "kind", "title", "author", "vibe", "about_episode"],
    "comments": ["run_id", "comment_id", "post_id", "author", "body", "vibe"],
}
