// app/api/github/route.ts
import { NextRequest, NextResponse } from 'next/server';
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
  error?: boolean;
}

const CACHE_KEY = 'wyck:github:stats';
const CACHE_TTL_SECONDS = 1 * 60 * 60;
const BATCH_SIZE = 15;

function sanitizeAlias(i: number) {
  return `u${i}`;
}

async function fetchBatch(usernames: string[], retries = 2): Promise<Record<string, GithubStats | null>> {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const fields = usernames
    .map(
      (login, i) => `
      ${sanitizeAlias(i)}: repositoryOwner(login: ${JSON.stringify(login)}) {
        __typename
        ... on User {
          contributionsCollection(from: "${from.toISOString()}", to: "${to.toISOString()}") {
            totalCommitContributions
            contributionCalendar { totalContributions }
          }
          repositories(ownerAffiliations: OWNER, first: 30, orderBy: {field: STARGAZERS, direction: DESC}, isFork: false) {
            totalCount
            nodes { stargazerCount forkCount }
          }
        }
        ... on Organization {
          repositories(first: 30, orderBy: {field: STARGAZERS, direction: DESC}, isFork: false) {
            totalCount
            nodes { stargazerCount forkCount }
          }
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

  if (res.status === 504 && retries > 0) {
    await new Promise((r) => setTimeout(r, 1000));
    return fetchBatch(usernames, retries - 1);
  }

  const json = await res.json();

  // Log lỗi thật ra thay vì im lặng throw
  if (json.errors) {
    console.error('GitHub GraphQL errors:', JSON.stringify(json.errors, null, 2));
  }
  if (!res.ok && !json.data) {
    throw new Error(`GitHub GraphQL error: ${res.status}`);
  }

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
      totalContributions: u.contributionsCollection?.contributionCalendar.totalContributions ?? 0,
      commits: u.contributionsCollection?.totalCommitContributions ?? 0,
      stars: nodes.reduce((s: number, r: any) => s + (r.stargazerCount || 0), 0),
      forks: nodes.reduce((s: number, r: any) => s + (r.forkCount || 0), 0),
      repoCount: u.repositories?.totalCount ?? 0,
    };
  });
  return out;
}

export async function GET(req: NextRequest) {
  const bypass = process.env.NODE_ENV !== 'production' || req.nextUrl.searchParams.get('force') === '1';

  if (!bypass) {
    const cached = await redis.get<Record<string, GithubStats>>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);
  }

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
    console.error('fetchBatch error:', e);
    return NextResponse.json({ error: 'GitHub API error' }, { status: 502 });
  }

  const result: Record<string, GithubStats> = {};
  caToUsername.forEach(([ca, v]) => {
    const stats = statsByUsername[v.github2];
    result[ca] = stats ?? ({ username: v.github2, error: true } as any);
  });

  await redis.set(CACHE_KEY, result, { ex: CACHE_TTL_SECONDS });
  return NextResponse.json(result);
}