export interface HistoryEntry {
  date: string;
  price: number | null;
  score: number;
  scoreDisplay: string;
}

export interface TokenEntry {
  symbol: string;
  CA: string;
  category: number;
  latestMarketCap: number | null;
  latestPrice: number | null;
  latestDate: string;
  latestScore: number;
  latestScoreDisplay: string;
  last7: HistoryEntry[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export async function fetchAllCategories(): Promise<TokenEntry[]> {
  if (!API_BASE) throw new Error('NEXT_PUBLIC_API_BASE chưa được cấu hình');

  const results = await Promise.all(
    [1, 2, 3].map(async (cat) => {
      const res = await fetch(`${API_BASE}/api/public/${cat}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Lỗi tải category ${cat}`);
      const data = await res.json();
      return (data.tokens || []) as TokenEntry[];
    })
  );

  return results.flat().sort((a, b) => b.latestScore - a.latestScore);
}