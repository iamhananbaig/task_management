import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';

/** "/" → the right starting screen. */
export default function Index() {
  const { signedIn, user } = useAuth();
  if (!signedIn) return <Redirect href="/login" />;
  if (user?.must_change_password) return <Redirect href="/set-password" />;
  return <Redirect href="/my-tasks" />;
}
