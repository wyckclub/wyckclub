import { TokenDetailShell } from '@/components/TokenDetailShell';

export default function BaseLayout({ children }: { children: React.ReactNode }) {
  return <TokenDetailShell chain="base">{children}</TokenDetailShell>;
}