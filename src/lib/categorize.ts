// Free, on-device guesses for manual entries. No network, no AI cost.
import type { ExpenseCategory, Necessity } from '../../shared/schemas';
import { CATEGORY_INFO } from './categories';

// Order matters: more specific phrases come first ("uber eats" before "uber", "gas bill" before "gas").
// Written with \b for readability; see `wholeWords` below for how they are actually matched.
const WORD_RULES: [RegExp, ExpenseCategory][] = [
  [/\b(uber ?eats|doordash|grubhub|deliveroo|just ?eat|postmates|restaurant|cafe|café|coffee|starbucks|mcdonald'?s|burger|pizza|sushi|takeaway|takeout|bar|pub|diner|kfc|chipotle|taco)\b/, 'dining'],
  [/\b(gas bill|electric|electricity|water bill|internet|wifi|broadband|phone bill|mobile plan|utility|utilities|sewer|trash)\b/, 'utilities'],
  [/\b(rent|mortgage|landlord|hoa|property tax)\b/, 'housing'],
  [/\b(grocery|groceries|supermarket|market|walmart|costco|aldi|lidl|kroger|safeway|trader joe'?s|whole foods|tesco|sainsbury'?s|carrefour|publix|wegmans|heb)\b/, 'groceries'],
  [/\b(pharmacy|doctor|dentist|clinic|hospital|medicine|prescription|cvs|walgreens|boots|therapy|optician)\b/, 'health'],
  [/\b(uber|lyft|taxi|cab|bus|metro|subway pass|train|transit|fuel|petrol|gas station|shell|chevron|exxon|bp|parking|toll|car repair|mechanic)\b/, 'transport'],
  [/\b(insurance|premium)\b/, 'insurance'],
  [/\b(loan|credit card payment|student loan|repayment|installment)\b/, 'debt'],
  [/\b(tuition|school|course|textbook|university|college)\b/, 'education'],
  [/\b(daycare|childcare|babysitter|nanny)\b/, 'childcare'],
  [/\b(netflix|spotify|hulu|disney\+?|apple music|youtube premium|prime video|hbo|patreon|subscription|icloud|xbox game pass|playstation plus)\b/, 'subscriptions'],
  [/\b(movie|cinema|concert|tickets?|steam|game|games|bowling|museum|festival)\b/, 'entertainment'],
  [/\b(hotel|airbnb|flight|airline|booking\.com|expedia|hostel|vacation|holiday)\b/, 'travel'],
  [/\b(salon|spa|barber|haircut|nails|cosmetics|sephora|ulta|makeup)\b/, 'personal_care'],
  [/\b(gift|present|birthday)\b/, 'gifts'],
  [/\b(amazon|target|ikea|mall|clothes|clothing|shoes|nike|adidas|zara|h&m|uniqlo|electronics|best buy|apple store)\b/, 'shopping'],
];

// JavaScript's \b only treats A–Z, 0–9 and _ as letters, so "café" could never match (é ends no word)
// and "Barça" matched "bar" (ç looked like a word break). Rebuild each rule so accented Latin letters
// count as part of a word. Plain lookahead and a leading group, no lookbehind or \p{…}, so it runs on
// any JS engine.
const LETTER = '0-9a-z_\\u00c0-\\u00d6\\u00d8-\\u00f6\\u00f8-\\u024f';
const wholeWords = (re: RegExp) => new RegExp(`(?:^|[^${LETTER}])${re.source.replace(/^\\b|\\b$/g, '')}(?![${LETTER}])`);
const RULES = WORD_RULES.map(([re, category]) => [wholeWords(re), category] as const);

export type Guess ={ category: ExpenseCategory; necessity: Necessity; /** The word that gave it away, e.g. "bus". */ matched: string };

export function categorize(text: string): Guess | null {
  // iOS keyboards type curly apostrophes (Trader Joe’s); match them like straight ones.
  const t = text.toLowerCase().replace(/[’‘`]/g, "'");
  if (!t.trim()) return null;
  for (const [re, category] of RULES) {
    const m = re.exec(t);
    if (m) return { category, necessity: CATEGORY_INFO[category].necessity ?? 'want', matched: m[1] };
  }
  return null;
}
