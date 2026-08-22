export type SearchRankField = {
  value?: string | null;
  weight: number;
  normalizeDigits?: boolean;
};

export type CalculateSearchPriorityOptions = {
  query: string;
  basePriority: number;
  fields: SearchRankField[];
};

export type SearchRank = {
  priority: number;
  isExactMatch: boolean;
};

const normalizeText = (value?: string | null): string => (value ?? '').trim().toLowerCase();

const normalizeDigits = (value?: string | null): string => (value ?? '').replace(/\D/g, '');

export function calculateSearchRank({
  query,
  basePriority,
  fields,
}: CalculateSearchPriorityOptions): SearchRank {
  const normalizedQuery = normalizeText(query);
  const digitQuery = normalizeDigits(query);

  if (!normalizedQuery) {
    return { priority: basePriority, isExactMatch: false };
  }

  let bestScore = basePriority;
  let isExactMatch = false;

  for (const field of fields) {
    const normalizedValue = normalizeText(field.value);

    if (!normalizedValue) {
      continue;
    }

    let score = basePriority;

    if (normalizedValue === normalizedQuery) {
      score += 1000 + field.weight;
      isExactMatch = true;
    } else if (normalizedValue.startsWith(normalizedQuery)) {
      score += 800 + field.weight;
    } else if (normalizedValue.includes(normalizedQuery)) {
      score += 600 + field.weight;
    }

    if (field.normalizeDigits && digitQuery) {
      const digitValue = normalizeDigits(field.value);

      if (digitValue === digitQuery) {
        score = Math.max(score, basePriority + 950 + field.weight);
        isExactMatch = true;
      } else if (digitValue.startsWith(digitQuery)) {
        score = Math.max(score, basePriority + 750 + field.weight);
      } else if (digitValue.includes(digitQuery)) {
        score = Math.max(score, basePriority + 550 + field.weight);
      }
    }

    bestScore = Math.max(bestScore, score);
  }

  return { priority: bestScore, isExactMatch };
}

export function calculateSearchPriority(options: CalculateSearchPriorityOptions): number {
  return calculateSearchRank(options).priority;
}
