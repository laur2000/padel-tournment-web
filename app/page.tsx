import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import LandingPage from '@/components/LandingPage';

export default async function Home() {
  const session = await getServerSession(authOptions);

  return <LandingPage user={session?.user} />;
}
