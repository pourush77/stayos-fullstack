/**
 * Client-side OCR + Indian ID detection using Tesseract.js.
 * Runs entirely in the browser — no keys, no server calls, no data leaves the machine.
 */
import { createWorker } from 'tesseract.js';

export type DetectedIdType = 'AADHAAR' | 'PAN' | 'PASSPORT' | 'VOTER_ID' | 'DRIVING_LICENSE' | 'OTHER';

export type IdDetectionResult = {
  idType: DetectedIdType;
  idNumber: string;
  fullName?: string;
  dateOfBirth?: string; // ISO YYYY-MM-DD
  rawText: string;
  confidence: number;
};

// Ordered by specificity: match tight formats first so a PAN inside a driving license doesn't win.
const ID_PATTERNS: Array<{ type: DetectedIdType; regex: RegExp; label: string }> = [
  // PAN: 5 letters + 4 digits + 1 letter, e.g. ABCDE1234F
  { type: 'PAN', regex: /\b([A-Z]{5}[0-9]{4}[A-Z])\b/, label: 'PAN' },
  // Aadhaar: exactly 4-4-4 digits separated by single space (Aadhaar cards always print this way on one line)
  { type: 'AADHAAR', regex: /\b(\d{4} \d{4} \d{4})\b/, label: 'Aadhaar' },
  // Voter ID (EPIC): 3 letters + 7 digits, e.g. ABC1234567
  { type: 'VOTER_ID', regex: /\b([A-Z]{3}[0-9]{7})\b/, label: 'Voter ID' },
  // Indian Passport: 1 letter + 7 digits, e.g. A1234567
  { type: 'PASSPORT', regex: /\b([A-PR-WYa-pr-wy][0-9]{7})\b/, label: 'Passport' },
  // Driving licence: 2 letters + 2 digits + optional space + 4-11 digits, e.g. MH14 20110012345
  { type: 'DRIVING_LICENSE', regex: /\b([A-Z]{2}[0-9]{2}[\s-]?[0-9]{4,11})\b/, label: 'Driving licence' },
];

function normalizeAadhaar(match: string): string {
  const digits = match.replace(/[^0-9]/g, '');
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
}

function looksLikeAadhaarContext(rawText: string): boolean {
  const upper = rawText.toUpperCase();
  return upper.includes('AADHAAR') || upper.includes('UIDAI') || upper.includes('GOVERNMENT OF INDIA') || upper.includes('AADHAR');
}

function looksLikePanContext(rawText: string): boolean {
  const upper = rawText.toUpperCase();
  return upper.includes('INCOME TAX') || upper.includes('PERMANENT ACCOUNT') || upper.includes('GOVT. OF INDIA');
}

// Lines we never want to accept as the person's name — these show up on every Indian ID card
const NAME_STOPWORDS = [
  'GOVERNMENT OF INDIA', 'GOVT OF INDIA', 'GOVT. OF INDIA', 'REPUBLIC OF INDIA',
  'INCOME TAX DEPARTMENT', 'INCOME TAX', 'PERMANENT ACCOUNT NUMBER', 'PERMANENT ACCOUNT',
  'UNIQUE IDENTIFICATION', 'UIDAI', 'AADHAAR', 'AADHAR', 'ELECTION COMMISSION',
  'DRIVING LICENCE', 'DRIVING LICENSE', 'PASSPORT', 'IDENTITY CARD',
  'DEPARTMENT', 'REGISTRAR', 'HOLDER', 'MALE', 'FEMALE', 'TRANSGENDER',
  'FATHER', 'MOTHER', 'HUSBAND', 'SPOUSE', 'GUARDIAN',
  'DATE OF BIRTH', 'DOB', 'YEAR OF BIRTH', 'ADDRESS',
];

function isPlausibleName(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (trimmed.length < 3 || trimmed.length > 50) return false;
  // Must contain letters, no digits, and not be a stopword line
  if (/\d/.test(trimmed)) return false;
  const upper = trimmed.toUpperCase();
  if (NAME_STOPWORDS.some((stop) => upper === stop || upper.includes(stop))) return false;
  // At least one space (multi-word name) OR at least 4 alpha chars for a single word
  const alpha = trimmed.replace(/[^A-Za-z]/g, '');
  if (alpha.length < 3) return false;
  // Reject strings dominated by non-letter characters
  if (alpha.length / trimmed.length < 0.6) return false;
  return true;
}

function titleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

function extractName(rawText: string, idType: DetectedIdType): string | undefined {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Passport: combine Surname + Given Names FIRST, before the generic "Name" matcher
  // (otherwise "Given Name(s)" alone captures only the first name).
  if (idType === 'PASSPORT') {
    let surname: string | undefined;
    let givenName: string | undefined;
    for (let i = 0; i < lines.length - 1; i += 1) {
      const label = lines[i].toLowerCase();
      const value = lines[i + 1];
      if (!isPlausibleName(value)) continue;
      if (label.includes('surname')) surname = value;
      if (label.includes('given')) givenName = value;
    }
    if (givenName && surname) return titleCase(`${givenName} ${surname}`);
    if (surname) return titleCase(surname);
    if (givenName) return titleCase(givenName);
  }

  // Strategy 1: "Name: XXXX" or "Name  XXXX" on the same line.
  for (const line of lines) {
    const match = line.match(/^\s*(?:Full\s+Name|Name)\s*[:\-]?\s+(.{2,})$/i);
    if (match && isPlausibleName(match[1])) {
      return titleCase(match[1]);
    }
  }

  // Strategy 2: "Name" on one line, actual name on the next.
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (/^(?:Full\s+Name|Name)\s*$/i.test(lines[i])) {
      const next = lines[i + 1];
      if (isPlausibleName(next)) return titleCase(next);
    }
  }

  // Strategy 3 (Aadhaar): the line immediately before DOB / Year of Birth is usually the name.
  if (idType === 'AADHAAR') {
    for (let i = 1; i < lines.length; i += 1) {
      const upper = lines[i].toUpperCase();
      if (upper.includes('DOB') || upper.includes('DATE OF BIRTH') || upper.includes('YEAR OF BIRTH')) {
        for (let j = i - 1; j >= 0; j -= 1) {
          if (isPlausibleName(lines[j])) return titleCase(lines[j]);
        }
      }
    }
  }

  return undefined;
}

const MONTH_MAP: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

function toIsoDate(day: string, month: string, year: string): string | undefined {
  const y = year.length === 2 ? (Number(year) > 30 ? `19${year}` : `20${year}`) : year;
  const yn = Number(y);
  const mn = Number(month);
  const dn = Number(day);
  if (yn < 1900 || yn > 2020) return undefined;
  if (mn < 1 || mn > 12) return undefined;
  if (dn < 1 || dn > 31) return undefined;
  return `${y}-${String(mn).padStart(2, '0')}-${String(dn).padStart(2, '0')}`;
}

function extractDateOfBirth(rawText: string): string | undefined {
  const cleaned = rawText.replace(/\s+/g, ' ');
  // 1) DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY, preceded by a DOB label
  const numericLabelled = cleaned.match(/(?:DOB|Date\s+of\s+Birth|Birth)\s*[:.\-]?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i);
  if (numericLabelled) {
    const iso = toIsoDate(numericLabelled[1], numericLabelled[2], numericLabelled[3]);
    if (iso) return iso;
  }
  // 2) DD MMM YYYY (passport style)
  const monthAlpha = cleaned.match(/(?:DOB|Date\s+of\s+Birth|Birth)\s*[:.\-]?\s*(\d{1,2})[\s\-\/](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]{0,6}[\s\-\/](\d{2,4})/i);
  if (monthAlpha) {
    const month = MONTH_MAP[monthAlpha[2].toUpperCase()];
    const iso = toIsoDate(monthAlpha[1], month, monthAlpha[3]);
    if (iso) return iso;
  }
  // 3) Year of Birth: 1985 (Aadhaar sometimes prints only the year)
  const yearOnly = cleaned.match(/Year\s+of\s+Birth\s*[:.\-]?\s*(\d{4})/i);
  if (yearOnly) {
    const iso = toIsoDate('01', '01', yearOnly[1]);
    if (iso) return iso;
  }
  // 4) Unlabelled DD/MM/YYYY anywhere in the text — take the first plausible one that isn't a future date
  const anyDate = cleaned.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (anyDate) {
    const iso = toIsoDate(anyDate[1], anyDate[2], anyDate[3]);
    if (iso) return iso;
  }
  return undefined;
}

export async function detectIdFromImage(imageBlob: Blob): Promise<IdDetectionResult | null> {
  const worker = await createWorker('eng');
  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(imageBlob);
    const upper = text.toUpperCase();

    // Try patterns in the strict order above.
    for (const pattern of ID_PATTERNS) {
      const match = upper.match(pattern.regex);
      if (!match) continue;
      let idNumber = match[1];

      // For Aadhaar we need extra caution: the 12-digit regex can trigger on any long number sequence.
      // Only accept it if the doc context signals Aadhaar OR if no other tighter match won already.
      if (pattern.type === 'AADHAAR') {
        idNumber = normalizeAadhaar(idNumber);
        if (!looksLikeAadhaarContext(text) && !/\b\d{4}\s\d{4}\s\d{4}\b/.test(text)) {
          continue; // Skip: 12 digits without Aadhaar context is likely a phone or account number.
        }
      }

      // PAN sanity check
      if (pattern.type === 'PAN' && !looksLikePanContext(text)) {
        // PAN pattern is quite specific already, keep it — just accept.
      }

      return {
        idType: pattern.type,
        idNumber,
        fullName: extractName(text, pattern.type),
        dateOfBirth: extractDateOfBirth(text),
        rawText: text,
        confidence,
      };
    }

    return {
      idType: 'OTHER',
      idNumber: '',
      fullName: extractName(text, 'OTHER'),
      dateOfBirth: extractDateOfBirth(text),
      rawText: text,
      confidence,
    };
  } finally {
    await worker.terminate();
  }
}
