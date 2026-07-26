/**
 * Deterministic structure from the uploaded script only.
 * No LLM involvement — speakers + repeated proper names in the text.
 */

export interface ExtractedCharacter {
  name: string;
  role: string;
  firstAppearsEpisode: number;
  notes?: string;
}

export interface ExtractedScene {
  id: string;
  episodeNumber: number;
  order: number;
  title: string;
  summary: string;
  charactersPresent: string[];
}

export interface ExtractedTimeline {
  episodeNumber: number;
  label: string;
  summary: string;
}

export interface ScriptGrounding {
  characters: ExtractedCharacter[];
  scenes: ExtractedScene[];
  timeline: ExtractedTimeline[];
}

const SPEAKER_RE =
  /^(?:\[SFX:[^\]]*\]\s*)*([A-Z][A-Z0-9 .''&\-]{1,48}?)(?:\s*\([^)]*\))?\s*:/gm;

/** Multi-word Proper Names in prose (e.g. Ince Zangwill). */
const PROSE_NAME_RE = /\b([A-Z][a-z]+(?:\s+(?:of|the|and|de|van|von)\s+)?(?:[A-Z][a-z]+)(?:\s+[A-Z][a-z]+){0,2})\b/g;

const NAME_DENY =
  /^(Episode|Narrator|End Of|Book|Chapter|Part|Scene|The Year|Fifth Epoch|Fourth Epoch|East Borough|Loen Kingdom|Sonia Sea|Blackthorn|True Creator's|Antigonus Family)\b/i;

function niceName(name: string): string {
  return name
    .split(/(\s+)/)
    .map((part) => {
      if (!part.trim()) return part;
      if (/^(of|the|and|de|van|von)$/i.test(part)) return part.toLowerCase();
      if (part.length <= 2) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('')
    .replace(/\bThe\b(?=\s+\w)/g, 'The');
}

function skipSpeaker(raw: string): boolean {
  const u = raw.toUpperCase();
  return u === 'NARRATOR' || u === 'SFX' || u === 'SYSTEM' || u.startsWith('END OF') || u.length < 2;
}

function guessRole(name: string): string {
  const u = name.toUpperCase();
  if (u.includes('WORTHY') || u.includes('CREATOR') || u.includes('DEMONESS')) return 'Antagonist force';
  if (u.includes('CAPTAIN') || u === 'DUNN SMITH') return 'Ally / mentor';
  return 'Character';
}

function firstNarratorBeat(text: string): string {
  const blocks = text.split(/\n\n+/);
  for (const b of blocks) {
    const trimmed = b.trim();
    const isSpeaker = /^[A-Z][A-Z0-9 .''&\-]+\s*(?:\([^)]*\))?\s*:/.test(trimmed);
    if (/^NARRATOR/i.test(trimmed) || (!isSpeaker && trimmed.length > 40 && !trimmed.startsWith('['))) {
      const clean = trimmed
        .replace(/^NARRATOR\s*:?\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (clean.length > 20) return clean.slice(0, 180) + (clean.length > 180 ? '…' : '');
    }
  }
  return '';
}

function epLabel(ep: { episodeNumber?: number }, index: number): number {
  const n = Number(ep.episodeNumber);
  return Number.isFinite(n) && n > 0 ? n : index + 1;
}

/** Earliest episode (upload order) whose script contains `name`. */
export function firstEpisodeMention(
  name: string,
  episodes: Array<{ episodeNumber?: number; scriptText?: string }>
): number | null {
  const key = name.toLowerCase().trim();
  if (!key || key.length < 2) return null;
  for (let i = 0; i < episodes.length; i++) {
    if ((episodes[i].scriptText || '').toLowerCase().includes(key)) {
      return epLabel(episodes[i], i);
    }
  }
  return null;
}

function countMentions(fullTextLower: string, name: string): number {
  const key = name.toLowerCase();
  if (!key) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = fullTextLower.indexOf(key, idx)) !== -1) {
    count++;
    idx += key.length;
  }
  return count;
}

/**
 * Build cast / scenes / timeline only from uploaded episode text.
 */
export function extractStructureFromEpisodes(
  episodes: Array<{ episodeNumber?: number; title?: string; scriptText?: string }>
): ScriptGrounding {
  const byKey = new Map<string, ExtractedCharacter>();
  const scenes: ExtractedScene[] = [];
  const timeline: ExtractedTimeline[] = [];
  const fullTextLower = episodes.map((e) => e.scriptText || '').join('\n').toLowerCase();

  const addCharacter = (rawName: string, preferName?: string) => {
    const name = niceName(preferName || rawName);
    const key = name.toLowerCase();
    if (key.length < 2 || NAME_DENY.test(name)) return;
    const first = firstEpisodeMention(name, episodes);
    if (first == null) return;
    if (!byKey.has(key)) {
      byKey.set(key, {
        name,
        role: guessRole(name),
        firstAppearsEpisode: first,
      });
    }
  };

  episodes.forEach((ep, index) => {
    const epNum = epLabel(ep, index);
    const text = ep.scriptText || '';
    const title = (ep.title || `Episode ${epNum}`).trim();

    timeline.push({
      episodeNumber: epNum,
      label: title,
      summary: firstNarratorBeat(text) || title,
    });

    const speakersInEp = new Set<string>();
    SPEAKER_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SPEAKER_RE.exec(text)) !== null) {
      const raw = m[1].trim();
      if (skipSpeaker(raw)) continue;
      const name = niceName(raw);
      speakersInEp.add(name);
      addCharacter(raw, name);
    }

    // Prose names (narrator mentions like "Ince Zangwill")
    PROSE_NAME_RE.lastIndex = 0;
    let pm: RegExpExecArray | null;
    while ((pm = PROSE_NAME_RE.exec(text)) !== null) {
      const candidate = pm[1].trim();
      if (NAME_DENY.test(candidate)) continue;
      if (candidate.split(/\s+/).length < 2) continue;
      // Keep if spoken as a character somewhere, or mentioned often enough to be a cast member
      const mentions = countMentions(fullTextLower, candidate);
      const isSpeaker = byKey.has(candidate.toLowerCase()) || speakersInEp.has(niceName(candidate));
      if (isSpeaker || mentions >= 2) {
        addCharacter(candidate);
      }
    }

    scenes.push({
      id: `ep${index + 1}-s1`,
      episodeNumber: epNum,
      order: 1,
      title,
      summary: firstNarratorBeat(text) || title,
      charactersPresent: [...speakersInEp].slice(0, 12),
    });
  });

  // Recompute first episode for every character (upload order)
  for (const c of byKey.values()) {
    const first = firstEpisodeMention(c.name, episodes);
    if (first != null) c.firstAppearsEpisode = first;
  }

  const characters = [...byKey.values()].sort(
    (a, b) => a.firstAppearsEpisode - b.firstAppearsEpisode || a.name.localeCompare(b.name)
  );

  return { characters, scenes, timeline };
}
