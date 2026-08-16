import { TokenDetailContent } from '@/components/TokenDetailContent';

export default async function RobinhoodTokenPage({ params }: { params: Promise<{ ca: string }> }) {
  const { ca } = await params;
  return <TokenDetailContent chain="robinhood" ca={ca} />;
}