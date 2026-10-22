import { LandingScreen } from '@/presentation/screens/landing-screen';
import { currentUser } from './_auth/session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  return <LandingScreen signedIn={(await currentUser()) !== undefined} />;
}
