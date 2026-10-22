import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginScreen } from '@/presentation/screens/login-screen';
import { login } from '../_auth/actions';
import { currentUser, safeNext } from '../_auth/session';

export const metadata: Metadata = { title: 'Ingresar · HatoScan' };
export const dynamic = 'force-dynamic';

interface Props {
  readonly searchParams: Promise<{ next?: string | string[] }>;
}

export default async function Page({ searchParams }: Props) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next);
  return <LoginScreen next={next} action={login} />;
}
