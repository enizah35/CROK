import { resolveAccountStatus, type AccountStatus } from './accountStatus';
import { useAuth } from './AuthProvider';
import { useMyProfile } from './queries';

export function useAccountStatus(): { status: AccountStatus; retry: () => void } {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  const profile = useMyProfile(userId);

  const status = resolveAccountStatus({
    sessionLoading: loading,
    userId,
    profileError: profile.isError,
    profile: profile.data,
  });

  return { status, retry: () => void profile.refetch() };
}
