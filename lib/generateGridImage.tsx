import { ImageResponse } from 'next/og';

interface GridItem {
  symbol: string;
  name: string | null;
  imageUrl: string | null;
  marketCap: number | null;
  verified: boolean | null;
}

function formatCapShort(cap: number | null) {
  if (cap == null) return 'N/A';
  if (cap >= 1_000_000) return '$' + (cap / 1_000_000).toFixed(2) + 'M';
  if (cap >= 1_000) return '$' + Math.round(cap / 1_000) + 'K';
  return '$' + Math.round(cap);
}

function VerifiedBadge() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" style={{ display: 'flex' }}>
      <path d="M12 2L3 6V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V6L12 2Z" fill="#0EA5E9" />
      <path d="M10 15.5L7 12.5L8.41 11.09L10 12.67L15.59 7.08L17 8.5L10 15.5Z" fill="white" />
    </svg>
  );
}

export async function generateGridImage(items: GridItem[], chain: string) {
  const title = `Tokens Triggering SmartMoney Signals on #${chain}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '2400px',
          height: '1350px',
          background: '#0a0a1a',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, color: '#fff', marginBottom: 50 }}>
          {title}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '60px', flex: 1 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '260px' }}>
              {it.imageUrl ? (
                <img
                  src={it.imageUrl}
                  width={220}
                  height={220}
                  style={{ borderRadius: '50%', border: '3px solid #334155', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: 220, height: 220, borderRadius: '50%', background: '#1e293b', display: 'flex' }} />
              )}

              <div style={{ marginTop: 20, fontSize: 34, fontWeight: 800, color: '#fff' }}>{it.symbol}</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                {it.name && (
                  <div style={{ fontSize: 22, color: '#94a3b8', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.name}
                  </div>
                )}
                {it.verified === true && <VerifiedBadge />}
              </div>

              <div style={{ marginTop: 6, fontSize: 26, color: '#94a3b8' }}>{formatCapShort(it.marketCap)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 30, fontWeight: 700, color: '#fff' }}>
          Powered by #WYCKSCORE on #{chain.toUpperCase()}
        </div>
      </div>
    ),
    { width: 2400, height: 1350 }
  );
}