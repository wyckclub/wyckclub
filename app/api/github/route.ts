// app/api/github/route.ts
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_KV_REST_API_URL!,
  token: process.env.REDIS_KV_REST_API_TOKEN!,
});

interface GithubStats {
  username: string;
  totalContributions: number;
  commits: number;
  stars: number;
  forks: number;
  repoCount: number;
}

const CACHE_KEY = 'wyck:github:stats';
const CACHE_TTL_SECONDS = 6 * 60 * 60;
const BATCH_SIZE = 50;

function sanitizeAlias(i: number) {
  return `u${i}`;
}

async function fetchBatch(usernames: string[]): Promise<Record<string, GithubStats | null>> {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const fields = usernames
    .map(
      (login, i) => `
    ${sanitizeAlias(i)}: user(login: ${JSON.stringify(login)}) {
      contributionsCollection(from: "${from.toISOString()}", to: "${to.toISOString()}") {
        totalCommitContributions
        contributionCalendar { totalContributions }
      }
      repositories(ownerAffiliations: OWNER, first: 100, orderBy: {field: STARGAZERS, direction: DESC}, isFork: false) {
        totalCount
        nodes { stargazerCount forkCount }
      }
    }`
    )
    .join('\n');

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: `query { ${fields} }` }),
  });

  if (!res.ok) throw new Error(`GitHub GraphQL error: ${res.status}`);
  const json = await res.json();

  const out: Record<string, GithubStats | null> = {};
  usernames.forEach((login, i) => {
    const u = json.data?.[sanitizeAlias(i)];
    if (!u) {
      out[login] = null;
      return;
    }
    const nodes = u.repositories?.nodes || [];
    out[login] = {
      username: login,
      totalContributions: u.contributionsCollection.contributionCalendar.totalContributions,
      commits: u.contributionsCollection.totalCommitContributions,
      stars: nodes.reduce((s: number, r: any) => s + (r.stargazerCount || 0), 0),
      forks: nodes.reduce((s: number, r: any) => s + (r.forkCount || 0), 0),
      repoCount: u.repositories?.totalCount ?? 0,
    };
  });
  return out;
}

export async function GET() {
  const cached = await redis.get<Record<string, GithubStats>>(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  const res = await fetch('https://wyck.live/github/getgit.php', { cache: 'no-store' });
  if (!res.ok) return NextResponse.json({ error: 'getgit.php error' }, { status: 502 });
  const map: Record<string, { github2: string; updated_at: string }> = await res.json();

  const caToUsername = Object.entries(map).filter(([, v]) => v.github2);
  const usernames = [...new Set(caToUsername.map(([, v]) => v.github2))];

  const statsByUsername: Record<string, GithubStats | null> = {};
  try {
    for (let i = 0; i < usernames.length; i += BATCH_SIZE) {
      const batch = usernames.slice(i, i + BATCH_SIZE);
      const result = await fetchBatch(batch);
      Object.assign(statsByUsername, result);
    }
  } catch (e) {
    return NextResponse.json({ error: 'GitHub API error' }, { status: 502 });
  }

  const result: Record<string, GithubStats> = {};
  caToUsername.forEach(([ca, v]) => {
    const stats = statsByUsername[v.github2];
    if (stats) result[ca] = stats;
  });

  await redis.set(CACHE_KEY, result, { ex: CACHE_TTL_SECONDS });
  return NextResponse.json(result);
}