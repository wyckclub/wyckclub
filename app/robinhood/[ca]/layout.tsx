import { TokenDetailShell } from '@/components/TokenDetailShell';

export default async function RobinhoodTokenLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ ca: string }> }) {
  const { ca } = await params;
  return <TokenDetailShell chain="robinhood" activeCa={ca}>{children}</TokenDetailShell>;
}