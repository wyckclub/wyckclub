export interface GithubStats {
  username: string;
  totalContributions: number;
  commits: number;
  stars: number;
  forks: number;
  repoCount: number;
  error?: boolean;
}

let cache: { data: Record<string, GithubStats>; timestamp: number } | null = null;
const TTL = 1 * 60 * 1000;

export async function fetchGithubStats(): Promise<Record<string, GithubStats>> {
  if (cache && Date.now() - cache.timestamp < TTL) return cache.data;
  const res = await fetch('/api/github', { cache: 'no-store' });
  if (!res.ok) return {};
  const data = await res.json();
  cache = { data, timestamp: Date.now() };
  return data;
}