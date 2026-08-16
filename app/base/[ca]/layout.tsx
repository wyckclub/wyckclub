import { TokenDetailShell } from '@/components/TokenDetailShell';

export default async function BaseTokenLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ ca: string }> }) {
  const { ca } = await params;
  return <TokenDetailShell chain="base" activeCa={ca}>{children}</TokenDetailShell>;
}