import { TokenDetailContent } from '@/components/TokenDetailContent';

export default async function ArcTokenPage({ params }: { params: Promise<{ ca: string }> }) {
  const { ca } = await params;
  return <TokenDetailContent chain="arc" ca={ca} />;
}