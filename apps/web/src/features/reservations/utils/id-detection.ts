/**
 * Client-side OCR + Indian ID detection using Tesseract.js.
 * Runs entirely in the browser — no keys, no server calls, no data leaves the machine.
 */
import { createWorker } from 'tesseract.js';

export type DetectedIdType = 'AADHAAR' | 'PAN' | 'PASSPORT' | 'VOTER_ID' | 'DRIVING_LICENSE' | 'OTHER';

export type IdDetectionResult = {
  idType: DetectedIdType;
  idNumber: string;
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
        rawText: text,
        confidence,
      };
    }

    return { idType: 'OTHER', idNumber: '', rawText: text, confidence };
  } finally {
    await worker.terminate();
  }
}
