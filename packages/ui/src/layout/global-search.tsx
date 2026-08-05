'use client';

import {
  Badge,
  Box,
  Center,
  Group,
  Loader,
  Popover,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { BedDouble, CalendarDays, FileText, Hotel, Search, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import { SearchInput } from '../components/search-input';

type GlobalSearchResultType = 'guest' | 'reservation' | 'stay' | 'room' | 'folio';

type GlobalSearchResult = {
  id: string;
  type: GlobalSearchResultType;
  title: string;
  subtitle: string;
  description?: string;
  badge?: string;
  route: string;
  priority: number;
};

type GlobalSearchGroups = {
  stays: GlobalSearchResult[];
  reservations: GlobalSearchResult[];
  guests: GlobalSearchResult[];
  rooms: GlobalSearchResult[];
  folios: GlobalSearchResult[];
};

type GlobalSearchResponse = {
  query: string;
  total: number;
  results: GlobalSearchGroups;
};

type StandardApiResponse<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

export type GlobalSearchProps = {
  apiBaseUrl: string;
  propertyId?: string;
};

type SearchGroupDefinition = {
  key: keyof GlobalSearchGroups;
  label: string;
  icon: LucideIcon;
};

const searchGroups: SearchGroupDefinition[] = [
  {
    key: 'stays',
    label: 'In-house guests',
    icon: Hotel,
  },
  {
    key: 'reservations',
    label: 'Reservations',
    icon: CalendarDays,
  },
  {
    key: 'guests',
    label: 'Guests',
    icon: UserRound,
  },
  {
    key: 'rooms',
    label: 'Rooms',
    icon: BedDouble,
  },
  {
    key: 'folios',
    label: 'Folios',
    icon: FileText,
  },
];

function getAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    window.localStorage.getItem('stayos.accessToken') ??
    window.sessionStorage.getItem('stayos.accessToken')
  );
}

function resultIcon(type: GlobalSearchResultType): LucideIcon {
  switch (type) {
    case 'stay':
      return Hotel;

    case 'reservation':
      return CalendarDays;

    case 'room':
      return BedDouble;

    case 'folio':
      return FileText;

    case 'guest':
    default:
      return UserRound;
  }
}

function badgeColor(type: GlobalSearchResultType) {
  switch (type) {
    case 'stay':
      return 'green';

    case 'reservation':
      return 'blue';

    case 'folio':
      return 'orange';

    case 'room':
      return 'violet';

    case 'guest':
    default:
      return 'gray';
  }
}

async function searchGlobalRecords(
  apiBaseUrl: string,
  propertyId: string,
  query: string,
  signal: AbortSignal,
): Promise<GlobalSearchResponse> {
  const baseUrl = apiBaseUrl.replace(/\/+$/, '');

  if (!baseUrl) {
    throw new Error('API base URL is not configured.');
  }

  const token = getAccessToken();

  const headers = new Headers({
    Accept: 'application/json',
  });

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const searchParams = new URLSearchParams({
    q: query,
    limit: '5',
  });

  const response = await fetch(
    `${baseUrl}/properties/${propertyId}/global-search?${searchParams.toString()}`,
    {
      cache: 'no-store',
      headers,
      signal,
    },
  );

  const payload = (await response.json().catch(() => undefined)) as
    StandardApiResponse<GlobalSearchResponse> | undefined;

  if (!response.ok) {
    throw new Error(payload?.message ?? `Search failed with status ${response.status}.`);
  }

  if (!payload?.data) {
    throw new Error('Global search returned an invalid response.');
  }

  return payload.data;
}

export function GlobalSearch({ apiBaseUrl, propertyId }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [opened, setOpened] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResponse, setSearchResponse] = useState<GlobalSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmedQuery = query.trim();

  const flatResults = useMemo(() => {
    if (!searchResponse) {
      return [];
    }

    return searchGroups.flatMap((group) => searchResponse.results[group.key]);
  }, [searchResponse]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpened(true);

        window.requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }
    }

    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, []);

  useEffect(() => {
    if (!propertyId || trimmedQuery.length < 2) {
      setSearchResponse(null);
      setError(undefined);
      setIsLoading(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setError(undefined);

      searchGlobalRecords(apiBaseUrl, propertyId, trimmedQuery, controller.signal)
        .then((response) => {
          setSearchResponse(response);
          setActiveIndex(response.total > 0 ? 0 : -1);
        })
        .catch((searchError: unknown) => {
          if (searchError instanceof DOMException && searchError.name === 'AbortError') {
            return;
          }

          setSearchResponse(null);
          setActiveIndex(-1);
          setError(searchError instanceof Error ? searchError.message : 'Unable to search StayOS.');
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [apiBaseUrl, propertyId, trimmedQuery]);

  function closeSearch() {
    setOpened(false);
    setActiveIndex(-1);
  }

  function openResult(result: GlobalSearchResult) {
    closeSearch();
    setQuery('');
    setSearchResponse(null);
    router.push(result.route);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
      inputRef.current?.blur();
      return;
    }

    if (flatResults.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();

      setActiveIndex((currentIndex) =>
        currentIndex >= flatResults.length - 1 ? 0 : currentIndex + 1,
      );

      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      setActiveIndex((currentIndex) =>
        currentIndex <= 0 ? flatResults.length - 1 : currentIndex - 1,
      );

      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();

      const selectedResult = flatResults[activeIndex];

      if (selectedResult) {
        openResult(selectedResult);
      }
    }
  }

  let currentResultIndex = -1;

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={520}
      position="bottom"
      shadow="xl"
      withinPortal
    >
      <Popover.Target>
        <SearchInput
          ref={inputRef}
          visibleFrom="md"
          w="100%"
          value={query}
          leftSection={<Search size={15} />}
          rightSection={
            isLoading ? (
              <Loader size={15} />
            ) : (
              <Group gap={4} wrap="nowrap">
                <Box
                  style={{
                    border: '1px solid #d9e1ef',
                    borderRadius: 6,
                    color: '#52627a',
                    fontSize: 11,
                    fontWeight: 500,
                    lineHeight: '16px',
                    minWidth: 24,
                    textAlign: 'center',
                  }}
                >
                  Ctrl
                </Box>

                <Box
                  style={{
                    border: '1px solid #d9e1ef',
                    borderRadius: 6,
                    color: '#52627a',
                    fontSize: 11,
                    fontWeight: 500,
                    lineHeight: '16px',
                    minWidth: 20,
                    textAlign: 'center',
                  }}
                >
                  K
                </Box>
              </Group>
            )
          }
          rightSectionWidth={64}
          placeholder="Search guests, rooms, bookings or folios..."
          aria-label="Global search"
          onFocus={() => setOpened(true)}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setOpened(true);
          }}
          onKeyDown={handleKeyDown}
          styles={{
            input: {
              borderColor: '#d9e1ef',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
              height: 42,
            },
          }}
        />
      </Popover.Target>

      <Popover.Dropdown
        p={0}
        style={{
          border: '1px solid #e5eaf2',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        {!propertyId ? (
          <Box px={spacing[4]} py={spacing[5]}>
            <Text c={colors.text.strong} style={typography.styles.label}>
              Property unavailable
            </Text>

            <Text c={colors.text.muted} mt={4} style={typography.styles.caption}>
              Select an active property before searching.
            </Text>
          </Box>
        ) : null}

        {propertyId && trimmedQuery.length < 2 ? (
          <Box px={spacing[4]} py={spacing[5]}>
            <Text c={colors.text.strong} style={typography.styles.label}>
              Search StayOS
            </Text>

            <Text c={colors.text.muted} mt={4} style={typography.styles.caption}>
              Enter at least two characters to search guests, reservations, rooms, stays and folios.
            </Text>
          </Box>
        ) : null}

        {isLoading && !searchResponse ? (
          <Center py={spacing[6]}>
            <Stack align="center" gap={spacing[2]}>
              <Loader size="sm" />

              <Text c={colors.text.muted} style={typography.styles.caption}>
                Searching StayOS...
              </Text>
            </Stack>
          </Center>
        ) : null}

        {error ? (
          <Box px={spacing[4]} py={spacing[5]}>
            <Text c="red" style={typography.styles.label}>
              Search unavailable
            </Text>

            <Text c={colors.text.muted} mt={4} style={typography.styles.caption}>
              {error}
            </Text>
          </Box>
        ) : null}

        {!isLoading && !error && searchResponse?.total === 0 ? (
          <Center py={spacing[8]}>
            <Stack align="center" gap={spacing[2]}>
              <Search size={22} color={colors.text.muted} />

              <Text c={colors.text.strong} style={typography.styles.label}>
                No matching records
              </Text>

              <Text c={colors.text.muted} ta="center" style={typography.styles.caption}>
                Try a guest name, mobile number, booking code, room number or folio number.
              </Text>
            </Stack>
          </Center>
        ) : null}

        {searchResponse && searchResponse.total > 0 ? (
          <ScrollArea.Autosize mah={500}>
            <Stack gap={0} py={spacing[2]}>
              {searchGroups.map((group) => {
                const results = searchResponse.results[group.key];

                if (results.length === 0) {
                  return null;
                }

                const GroupIcon = group.icon;

                return (
                  <Box key={group.key}>
                    <Group gap={spacing[2]} px={spacing[4]} pb={spacing[1]} pt={spacing[3]}>
                      <GroupIcon size={14} color={colors.text.muted} />

                      <Text
                        c={colors.text.muted}
                        tt="uppercase"
                        style={{
                          ...typography.styles.caption,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                        }}
                      >
                        {group.label}
                      </Text>

                      <Badge size="xs" variant="light" color="gray">
                        {results.length}
                      </Badge>
                    </Group>

                    <Stack gap={2} px={spacing[2]}>
                      {results.map((result) => {
                        currentResultIndex += 1;

                        const resultIndex = currentResultIndex;
                        const ResultIcon = resultIcon(result.type);
                        const isActive = activeIndex === resultIndex;

                        return (
                          <UnstyledButton
                            key={`${result.type}-${result.id}`}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                            }}
                            onMouseEnter={() => {
                              setActiveIndex(resultIndex);
                            }}
                            onClick={() => {
                              openResult(result);
                            }}
                            style={{
                              background: isActive ? colors.brand[50] : 'transparent',
                              borderRadius: radius.md,
                              padding: spacing[3],
                              transition: 'background-color 120ms ease',
                              width: '100%',
                            }}
                          >
                            <Group gap={spacing[3]} wrap="nowrap" align="flex-start">
                              <Box
                                aria-hidden
                                style={{
                                  alignItems: 'center',
                                  background: colors.brand[50],
                                  borderRadius: radius.md,
                                  color: colors.brand[500],
                                  display: 'flex',
                                  flex: '0 0 auto',
                                  height: 36,
                                  justifyContent: 'center',
                                  width: 36,
                                }}
                              >
                                <ResultIcon size={17} />
                              </Box>

                              <Box
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                }}
                              >
                                <Group justify="space-between" gap={spacing[2]} wrap="nowrap">
                                  <Text
                                    c={colors.text.strong}
                                    lineClamp={1}
                                    style={typography.styles.label}
                                  >
                                    {result.title}
                                  </Text>

                                  {result.badge ? (
                                    <Badge
                                      color={badgeColor(result.type)}
                                      size="xs"
                                      variant="light"
                                    >
                                      {result.badge.replaceAll('_', ' ')}
                                    </Badge>
                                  ) : null}
                                </Group>

                                <Text
                                  c={colors.text.body}
                                  lineClamp={1}
                                  mt={2}
                                  style={typography.styles.caption}
                                >
                                  {result.subtitle}
                                </Text>

                                {result.description ? (
                                  <Text
                                    c={colors.text.muted}
                                    lineClamp={1}
                                    mt={2}
                                    style={{
                                      ...typography.styles.caption,
                                      fontSize: 11,
                                    }}
                                  >
                                    {result.description}
                                  </Text>
                                ) : null}
                              </Box>
                            </Group>
                          </UnstyledButton>
                        );
                      })}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </ScrollArea.Autosize>
        ) : null}

        {searchResponse && searchResponse.total > 0 ? (
          <Group
            justify="space-between"
            px={spacing[4]}
            py={spacing[3]}
            style={{
              borderTop: '1px solid #edf0f5',
            }}
          >
            <Text c={colors.text.muted} style={typography.styles.caption}>
              {searchResponse.total} results found
            </Text>

            <Text
              c={colors.text.muted}
              style={{
                ...typography.styles.caption,
                fontSize: 11,
              }}
            >
              ↑ ↓ Navigate · Enter Open · Esc Close
            </Text>
          </Group>
        ) : null}
      </Popover.Dropdown>
    </Popover>
  );
}
