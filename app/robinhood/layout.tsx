import { TokenDetailShell } from '@/components/TokenDetailShell';

export default function RobinhoodLayout({ children }: { children: React.ReactNode }) {
  return <TokenDetailShell chain="robinhood">{children}</TokenDetailShell>;
}