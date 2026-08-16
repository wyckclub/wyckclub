import { TokenDetailContent } from '@/components/TokenDetailContent';

export default async function BaseTokenPage({ params }: { params: Promise<{ ca: string }> }) {
  const { ca } = await params;
  return <TokenDetailContent chain="base" ca={ca} />;
}