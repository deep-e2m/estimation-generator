/**
 * Hook to resolve user avatar URL: uses backend API when user has no avatar_url,
 * falls back to client-side name-based placeholder on loading/error.
 */
import { useQuery } from '@tanstack/react-query';
import { utilsService } from '@/services/utils.service';
import { getPlaceholderAvatarUrl } from '@/lib/placeholderAvatars';

export interface UseUserAvatarUrlResult {
  url: string;
  isPending: boolean;
}

/**
 * Returns the URL to use for a user's avatar. When avatarUrl is set, returns it.
 * When not set, fetches placeholder from API (with client-side fallback on error).
 */
export function useUserAvatarUrl(
  avatarUrl: string | undefined | null,
  fullName: string
): UseUserAvatarUrlResult {
  const fullNameForQuery = fullName?.trim() || '';
  const { data, isFetching } = useQuery({
    queryKey: ['user-avatar', fullNameForQuery],
    queryFn: () => utilsService.getPlaceholderAvatarUrl(fullNameForQuery),
    enabled: !avatarUrl?.trim() && fullNameForQuery.length > 0,
    staleTime: 1000 * 60 * 5, // 5 min
    placeholderData: getPlaceholderAvatarUrl(fullNameForQuery),
  });

  const resolvedUrl =
    avatarUrl?.trim() || (data ?? getPlaceholderAvatarUrl(fullNameForQuery));
  return {
    url: resolvedUrl,
    isPending: !avatarUrl?.trim() && isFetching,
  };
}
