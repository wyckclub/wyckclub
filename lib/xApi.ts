import crypto from 'crypto';

function pct(s: string) {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function buildAuthHeader(method: string, url: string) {
  const oauth: Record<string, string> = {
    oauth_consumer_key: process.env.X_API_KEY!,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.X_ACCESS_TOKEN!,
    oauth_version: '1.0',
  };
  const baseString = [
    method.toUpperCase(),
    pct(url),
    pct(Object.keys(oauth).sort().map((k) => `${pct(k)}=${pct(oauth[k])}`).join('&')),
  ].join('&');
  const signingKey = `${pct(process.env.X_API_SECRET!)}&${pct(process.env.X_ACCESS_TOKEN_SECRET!)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  const all: Record<string, string> = { ...oauth, oauth_signature: signature };
  return 'OAuth ' + Object.keys(all).sort().map((k) => `${pct(k)}="${pct(all[k])}"`).join(', ');
}

export async function postTweet(text: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const url = 'https://api.twitter.com/2/tweets';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: buildAuthHeader('POST', url), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const json = await res.json();
  if (!res.ok) return { ok: false, error: JSON.stringify(json) };
  return { ok: true, id: json.data?.id };
}