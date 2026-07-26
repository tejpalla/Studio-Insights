# Helix arena — Databricks heat clustering
# Import into a Databricks Python notebook. Set RUN_ID to a synced arena run.

from pyspark.sql import functions as F
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans

CATALOG = "workspace"
SCHEMA = "default"
VOLUME = "helix_arena"
RUN_ID = "REPLACE_WITH_RUN_ID"

BASE = f"/Volumes/{CATALOG}/{SCHEMA}/{VOLUME}/helix-arena/{RUN_ID}"

try:
    posts = spark.read.option("multiLine", True).json(f"{BASE}/posts.json")
    comments = spark.read.option("multiLine", True).json(f"{BASE}/comments.json")
    agents = spark.read.option("multiLine", True).json(f"{BASE}/agents.json")
    events = spark.read.json(f"{BASE}/events.jsonl")
except Exception:
    posts = spark.read.option("header", True).csv(f"{BASE}/posts.csv")
    comments = spark.read.option("header", True).csv(f"{BASE}/comments.csv")
    agents = spark.createDataFrame([], "agent_id STRING")
    events = spark.createDataFrame([], "event_type STRING")

print("posts", posts.count(), "comments", comments.count())

posts.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.helix_arena_posts")
comments.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.helix_arena_comments")
if agents.take(1):
    agents.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.helix_arena_agents")
if events.take(1):
    events.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.helix_arena_events")

pdf = comments.select(
    F.col("body").alias("text"),
    F.col("post_id"),
    F.col("author"),
).dropna(subset=["text"]).toPandas()

if len(pdf) < 8:
    print("Not enough comments to cluster — re-run arena with deeper threads.")
else:
    n_clusters = min(6, max(2, len(pdf) // 15))
    vec = TfidfVectorizer(max_features=2000, stop_words="english", ngram_range=(1, 2))
    X = vec.fit_transform(pdf["text"].astype(str))
    km = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
    pdf["cluster"] = km.fit_predict(X)

    terms = vec.get_feature_names_out()
    print("\n=== Heat clusters (what sparks discussion) ===")
    for i in range(n_clusters):
        center = km.cluster_centers_[i]
        top_idx = center.argsort()[-8:][::-1]
        top_terms = [terms[j] for j in top_idx]
        size = int((pdf["cluster"] == i).sum())
        print(f"cluster {i} (n={size}): {', '.join(top_terms)}")

    spark.createDataFrame(pdf[["post_id", "author", "text", "cluster"]]).write.mode(
        "overwrite"
    ).saveAsTable(f"{CATALOG}.{SCHEMA}.helix_arena_heat_clusters")

storm = (
    comments.groupBy("post_id")
    .count()
    .withColumnRenamed("count", "comment_n")
    .orderBy(F.desc("comment_n"))
)
storm.show(15, truncate=False)
storm.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.helix_arena_reply_storms")

print("Done. Query helix_arena_heat_clusters + helix_arena_reply_storms in SQL Editor.")
