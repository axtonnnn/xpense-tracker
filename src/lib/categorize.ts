// Free, on-device guesses for manual entries. No network, no AI cost.
import type { ExpenseCategory, Necessity } from '../../shared/schemas';
import { CATEGORY_INFO } from './categories';

// Order matters: more specific phrases come first ("uber eats" before "uber", "gas bill" before "gas").
const RULES: [RegExp, ExpenseCategory][] = [
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

export type Guess = { category: ExpenseCategory; necessity: Necessity; /** The word that gave it away, e.g. "bus". */ matched: string };

export function categorize(text: string): Guess | null {
  // iOS keyboards type curly apostrophes (Trader Joe’s); match them like straight ones.
  const t = text.toLowerCase().replace(/[’‘`]/g, "'");
  if (!t.trim()) return null;
  for (const [re, category] of RULES) {
    const m = re.exec(t);
    if (m) return { category, necessity: CATEGORY_INFO[category].necessity ?? 'want', matched: m[0] };
  }
  return null;
}
