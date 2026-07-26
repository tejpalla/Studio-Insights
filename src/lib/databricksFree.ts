/**
 * Databricks sync for Helix arena runs.
 * Uploads the run pack to a Unity Catalog volume; heat clustering runs in docs/databricks/helix_arena_heat.py.
 */

import fs from 'fs';
import path from 'path';

export interface DatabricksSyncResult {
  synced: boolean;
  mode: 'skipped' | 'local_only' | 'volume_upload' | 'error';
  volumePath?: string;
  localDir?: string;
  message?: string;
  files?: string[];
}

export interface ArenaExportPack {
  runId: string;
  title: string;
  eventsJsonl: string;
  run: Record<string, unknown>;
  agents: unknown[];
  posts: unknown[];
  comments: unknown[];
}

function getDatabricksConfig() {
  const host = (process.env.DATABRICKS_HOST || '').replace(/\/$/, '').trim();
  const token = (process.env.DATABRICKS_TOKEN || '').trim();
  const catalog = (process.env.DATABRICKS_CATALOG || 'workspace').trim();
  const schema = (process.env.DATABRICKS_SCHEMA || 'default').trim();
  const volume = (process.env.DATABRICKS_VOLUME || 'helix_arena').trim();
  return { host, token, catalog, schema, volume };
}

export function isDatabricksConfigured(): boolean {
  const { host, token } = getDatabricksConfig();
  return Boolean(host && token);
}

export function writeArenaExportPack(pack: ArenaExportPack): string {
  const dir = path.join(process.cwd(), 'data', 'arena-runs', pack.runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'events.jsonl'), pack.eventsJsonl, 'utf8');
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(pack.run, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'agents.json'), JSON.stringify(pack.agents, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'posts.json'), JSON.stringify(pack.posts, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'comments.json'), JSON.stringify(pack.comments, null, 2), 'utf8');
  const postCsv = [
    'run_id,post_id,kind,title,author,vibe,about_episode,upvotes,body',
    ...pack.posts.map((p: any) =>
      [
        pack.runId,
        p.post_id ?? p.id,
        p.kind,
        csv(p.title),
        p.author,
        p.vibe,
        p.about_episode ?? p.aboutEpisode ?? '',
        p.upvotes ?? 0,
        csv(p.body),
      ].join(',')
    ),
  ].join('\n');
  const commentCsv = [
    'run_id,comment_id,post_id,author,vibe,upvotes,body,depth',
    ...pack.comments.map((c: any) =>
      [
        pack.runId,
        c.comment_id ?? c.id,
        c.post_id ?? c.postId,
        c.author,
        c.vibe || '',
        c.upvotes ?? 0,
        csv(c.body),
        c.depth ?? 0,
      ].join(',')
    ),
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'posts.csv'), postCsv, 'utf8');
  fs.writeFileSync(path.join(dir, 'comments.csv'), commentCsv, 'utf8');
  return dir;
}

function csv(v: unknown) {
  const s = String(v ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

async function putVolumeFile(
  host: string,
  token: string,
  volumeFilePath: string,
  body: Buffer | string
): Promise<void> {
  const url = `${host}/api/2.0/fs/files${volumeFilePath}?overwrite=true`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: typeof body === 'string' ? Buffer.from(body, 'utf8') : body,
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => '');
    throw new Error(`Volume upload failed (${res.status}): ${text.slice(0, 240)}`);
  }
}

async function ensureVolumeDirectory(host: string, token: string, dirPath: string): Promise<void> {
  const url = `${host}/api/2.0/fs/directories${dirPath}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 409 && res.status !== 204 && res.status !== 200) {
    const text = await res.text().catch(() => '');
    console.warn('Directory ensure soft-fail:', res.status, text.slice(0, 120));
  }
}

/** Write local pack always. If workspace credentials are set, upload to UC Volume. */
export async function syncArenaPackToDatabricksFree(
  pack: ArenaExportPack,
  opts?: { sync?: boolean }
): Promise<DatabricksSyncResult> {
  const localDir = writeArenaExportPack(pack);
  const files = ['events.jsonl', 'run.json', 'agents.json', 'posts.json', 'comments.json', 'posts.csv', 'comments.csv'];

  if (opts?.sync === false) {
    return {
      synced: false,
      mode: 'skipped',
      localDir,
      files,
      message: 'Databricks sync skipped.',
    };
  }

  const { host, token, catalog, schema, volume } = getDatabricksConfig();
  if (!host || !token) {
    return {
      synced: false,
      mode: 'local_only',
      localDir,
      files,
      message:
        'Export pack written locally. Set DATABRICKS_HOST + DATABRICKS_TOKEN to sync to Unity Catalog.',
    };
  }

  const base = `/Volumes/${catalog}/${schema}/${volume}/helix-arena/${pack.runId}`;
  try {
    await ensureVolumeDirectory(host, token, `/Volumes/${catalog}/${schema}/${volume}`);
    await ensureVolumeDirectory(host, token, `/Volumes/${catalog}/${schema}/${volume}/helix-arena`);
    await ensureVolumeDirectory(host, token, base);

    const uploads: Array<[string, string]> = [
      ['events.jsonl', pack.eventsJsonl],
      ['run.json', JSON.stringify(pack.run, null, 2)],
      ['agents.json', JSON.stringify(pack.agents, null, 2)],
      ['posts.json', JSON.stringify(pack.posts, null, 2)],
      ['comments.json', JSON.stringify(pack.comments, null, 2)],
    ];
    for (const [name, content] of uploads) {
      await putVolumeFile(host, token, `${base}/${name}`, content);
    }
    for (const name of ['posts.csv', 'comments.csv']) {
      const buf = fs.readFileSync(path.join(localDir, name));
      await putVolumeFile(host, token, `${base}/${name}`, buf);
    }

    return {
      synced: true,
      mode: 'volume_upload',
      volumePath: base,
      localDir,
      files,
      message: `Synced to Databricks volume ${base}. Run docs/databricks/helix_arena_heat.py for heat clusters.`,
    };
  } catch (err: any) {
    return {
      synced: false,
      mode: 'error',
      volumePath: base,
      localDir,
      files,
      message: err?.message || 'Databricks upload failed',
    };
  }
}

export function buildArenaExportPack(state: {
  runId: string;
  title: string;
  agents: Array<{ id: string; username: string; archetype: string; strategy: string; flair: string; bias: string }>;
  posts: any[];
  events: any[];
  plan: any;
  seed: number;
}, eventsJsonl: string): ArenaExportPack {
  const comments: any[] = [];
  for (const p of state.posts) {
    for (const c of p.comments || []) {
      comments.push({
        comment_id: c.id,
        post_id: p.id,
        author: c.username,
        vibe: c.vibe,
        upvotes: c.upvotes,
        body: c.body,
        depth: 0,
      });
      for (const r of c.replies || []) {
        comments.push({
          comment_id: r.id,
          post_id: p.id,
          author: r.username,
          vibe: '',
          upvotes: r.upvotes,
          body: r.body,
          depth: 1,
        });
      }
    }
  }

  return {
    runId: state.runId,
    title: state.title,
    eventsJsonl,
    run: {
      run_id: state.runId,
      series_title: state.title,
      agent_count: state.agents.length,
      rounds: state.plan?.rounds,
      lore_score: state.plan?.loreScore,
      target_posts: state.plan?.targetPosts,
      target_comments: state.plan?.targetComments,
      post_count: state.posts.length,
      comment_count: comments.length,
      seed: state.seed,
      finished_at: new Date().toISOString(),
    },
    agents: state.agents.map((a) => ({
      run_id: state.runId,
      agent_id: a.id,
      username: a.username,
      archetype: a.archetype,
      strategy: a.strategy,
      flair: a.flair,
      vibe_bias: a.bias,
    })),
    posts: state.posts.map((p) => ({
      post_id: p.id,
      kind: p.kind,
      title: p.title,
      author: p.author,
      body: p.body,
      vibe: p.vibe,
      about_episode: p.aboutEpisode,
      upvotes: p.upvotes,
    })),
    comments,
  };
}
