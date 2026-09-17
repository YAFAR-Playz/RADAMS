// Curated for a tutoring-center SaaS whose primary market is Egypt/MENA,
// with a broad enough set of other major markets to not force a customer
// elsewhere in the world into "Other". Not the full ~195-country ITU list —
// add to this rather than trying to be exhaustive.
export type CountryCode = { name: string; nameAr: string; iso2: string; dial: string };

export const COUNTRY_CODES: CountryCode[] = [
  // Arab League / MENA first, since that's this product's primary market.
  { name: "Egypt", nameAr: "مصر", iso2: "EG", dial: "20" },
  { name: "Saudi Arabia", nameAr: "السعودية", iso2: "SA", dial: "966" },
  { name: "United Arab Emirates", nameAr: "الإمارات", iso2: "AE", dial: "971" },
  { name: "Kuwait", nameAr: "الكويت", iso2: "KW", dial: "965" },
  { name: "Qatar", nameAr: "قطر", iso2: "QA", dial: "974" },
  { name: "Bahrain", nameAr: "البحرين", iso2: "BH", dial: "973" },
  { name: "Oman", nameAr: "عُمان", iso2: "OM", dial: "968" },
  { name: "Jordan", nameAr: "الأردن", iso2: "JO", dial: "962" },
  { name: "Lebanon", nameAr: "لبنان", iso2: "LB", dial: "961" },
  { name: "Iraq", nameAr: "العراق", iso2: "IQ", dial: "964" },
  { name: "Syria", nameAr: "سوريا", iso2: "SY", dial: "963" },
  { name: "Palestine", nameAr: "فلسطين", iso2: "PS", dial: "970" },
  { name: "Yemen", nameAr: "اليمن", iso2: "YE", dial: "967" },
  { name: "Libya", nameAr: "ليبيا", iso2: "LY", dial: "218" },
  { name: "Tunisia", nameAr: "تونس", iso2: "TN", dial: "216" },
  { name: "Algeria", nameAr: "الجزائر", iso2: "DZ", dial: "213" },
  { name: "Morocco", nameAr: "المغرب", iso2: "MA", dial: "212" },
  { name: "Sudan", nameAr: "السودان", iso2: "SD", dial: "249" },
  { name: "Mauritania", nameAr: "موريتانيا", iso2: "MR", dial: "222" },
  { name: "Somalia", nameAr: "الصومال", iso2: "SO", dial: "252" },
  { name: "Djibouti", nameAr: "جيبوتي", iso2: "DJ", dial: "253" },
  { name: "Comoros", nameAr: "جزر القمر", iso2: "KM", dial: "269" },

  // Other major markets, roughly grouped by region.
  { name: "Turkey", nameAr: "تركيا", iso2: "TR", dial: "90" },
  { name: "United States", nameAr: "الولايات المتحدة", iso2: "US", dial: "1" },
  { name: "Canada", nameAr: "كندا", iso2: "CA", dial: "1" },
  { name: "United Kingdom", nameAr: "المملكة المتحدة", iso2: "GB", dial: "44" },
  { name: "Ireland", nameAr: "أيرلندا", iso2: "IE", dial: "353" },
  { name: "France", nameAr: "فرنسا", iso2: "FR", dial: "33" },
  { name: "Germany", nameAr: "ألمانيا", iso2: "DE", dial: "49" },
  { name: "Italy", nameAr: "إيطاليا", iso2: "IT", dial: "39" },
  { name: "Spain", nameAr: "إسبانيا", iso2: "ES", dial: "34" },
  { name: "Netherlands", nameAr: "هولندا", iso2: "NL", dial: "31" },
  { name: "Belgium", nameAr: "بلجيكا", iso2: "BE", dial: "32" },
  { name: "Switzerland", nameAr: "سويسرا", iso2: "CH", dial: "41" },
  { name: "Sweden", nameAr: "السويد", iso2: "SE", dial: "46" },
  { name: "Greece", nameAr: "اليونان", iso2: "GR", dial: "30" },
  { name: "India", nameAr: "الهند", iso2: "IN", dial: "91" },
  { name: "Pakistan", nameAr: "باكستان", iso2: "PK", dial: "92" },
  { name: "Bangladesh", nameAr: "بنغلاديش", iso2: "BD", dial: "880" },
  { name: "China", nameAr: "الصين", iso2: "CN", dial: "86" },
  { name: "Japan", nameAr: "اليابان", iso2: "JP", dial: "81" },
  { name: "South Korea", nameAr: "كوريا الجنوبية", iso2: "KR", dial: "82" },
  { name: "Indonesia", nameAr: "إندونيسيا", iso2: "ID", dial: "62" },
  { name: "Malaysia", nameAr: "ماليزيا", iso2: "MY", dial: "60" },
  { name: "Singapore", nameAr: "سنغافورة", iso2: "SG", dial: "65" },
  { name: "Philippines", nameAr: "الفلبين", iso2: "PH", dial: "63" },
  { name: "Nigeria", nameAr: "نيجيريا", iso2: "NG", dial: "234" },
  { name: "Kenya", nameAr: "كينيا", iso2: "KE", dial: "254" },
  { name: "South Africa", nameAr: "جنوب أفريقيا", iso2: "ZA", dial: "27" },
  { name: "Ethiopia", nameAr: "إثيوبيا", iso2: "ET", dial: "251" },
  { name: "Australia", nameAr: "أستراليا", iso2: "AU", dial: "61" },
  { name: "New Zealand", nameAr: "نيوزيلندا", iso2: "NZ", dial: "64" },
  { name: "Brazil", nameAr: "البرازيل", iso2: "BR", dial: "55" },
  { name: "Mexico", nameAr: "المكسيك", iso2: "MX", dial: "52" },
];

// Regional indicator flag emoji are two Unicode scalars derived directly
// from the ISO-3166 alpha-2 code (A-Z -> U+1F1E6-U+1F1FF) — computed here
// instead of hardcoded per row, so the data above stays just the facts.
export function flagEmoji(iso2: string): string {
  return String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65)));
}
