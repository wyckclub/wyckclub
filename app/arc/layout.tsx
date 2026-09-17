import { TokenDetailShell } from '@/components/TokenDetailShell';

export default function ArcLayout({ children }: { children: React.ReactNode }) {
  return <TokenDetailShell chain="arc">{children}</TokenDetailShell>;
}