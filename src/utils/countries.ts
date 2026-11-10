export interface CountryData {
  name: string;
  code: string; // ISO 2-letter
  dialCode: string; // e.g. "+91"
  flag: string;
  minDigits: number;
  maxDigits: number;
  placeholder: string;
}

export const COUNTRIES: CountryData[] = [
  { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳', minDigits: 10, maxDigits: 10, placeholder: '98765 43210' },
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸', minDigits: 10, maxDigits: 10, placeholder: '555 123 4567' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧', minDigits: 10, maxDigits: 11, placeholder: '7911 123456' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪', minDigits: 9, maxDigits: 9, placeholder: '50 123 4567' },
  { name: 'Saudi Arabia', code: 'SA', dialCode: '+966', flag: '🇸🇦', minDigits: 9, maxDigits: 9, placeholder: '50 123 4567' },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦', minDigits: 10, maxDigits: 10, placeholder: '416 123 4567' },
  { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺', minDigits: 9, maxDigits: 9, placeholder: '412 345 678' },
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪', minDigits: 10, maxDigits: 11, placeholder: '151 12345678' },
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷', minDigits: 9, maxDigits: 9, placeholder: '6 12 34 56 78' },
  { name: 'Japan', code: 'JP', dialCode: '+81', flag: '🇯🇵', minDigits: 10, maxDigits: 10, placeholder: '90 1234 5678' },
  { name: 'Pakistan', code: 'PK', dialCode: '+92', flag: '🇵🇰', minDigits: 10, maxDigits: 10, placeholder: '300 1234567' },
  { name: 'Bangladesh', code: 'BD', dialCode: '+880', flag: '🇧🇩', minDigits: 10, maxDigits: 10, placeholder: '1712 345678' },
  { name: 'Singapore', code: 'SG', dialCode: '+65', flag: '🇸🇬', minDigits: 8, maxDigits: 8, placeholder: '8123 4567' },
  { name: 'Malaysia', code: 'MY', dialCode: '+60', flag: '🇲🇾', minDigits: 9, maxDigits: 10, placeholder: '12 345 6789' },
  { name: 'Indonesia', code: 'ID', dialCode: '+62', flag: '🇮🇩', minDigits: 9, maxDigits: 12, placeholder: '812 3456 7890' },
  { name: 'Italy', code: 'IT', dialCode: '+39', flag: '🇮🇹', minDigits: 9, maxDigits: 10, placeholder: '312 345 6789' },
  { name: 'Spain', code: 'ES', dialCode: '+34', flag: '🇪🇸', minDigits: 9, maxDigits: 9, placeholder: '612 345 678' },
  { name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷', minDigits: 10, maxDigits: 11, placeholder: '11 91234 5678' },
  { name: 'China', code: 'CN', dialCode: '+86', flag: '🇨🇳', minDigits: 11, maxDigits: 11, placeholder: '138 0013 8000' },
  { name: 'Russia', code: 'RU', dialCode: '+7', flag: '🇷🇺', minDigits: 10, maxDigits: 10, placeholder: '912 345 6789' },
  { name: 'Turkey', code: 'TR', dialCode: '+90', flag: '🇹🇷', minDigits: 10, maxDigits: 10, placeholder: '532 123 4567' },
  { name: 'South Africa', code: 'ZA', dialCode: '+27', flag: '🇿🇦', minDigits: 9, maxDigits: 9, placeholder: '71 123 4567' },
  { name: 'Nigeria', code: 'NG', dialCode: '+234', flag: '🇳🇬', minDigits: 10, maxDigits: 10, placeholder: '802 123 4567' },
  { name: 'Egypt', code: 'EG', dialCode: '+20', flag: '🇪🇬', minDigits: 10, maxDigits: 10, placeholder: '10 1234 5678' },
  { name: 'Mexico', code: 'MX', dialCode: '+52', flag: '🇲🇽', minDigits: 10, maxDigits: 10, placeholder: '55 1234 5678' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31', flag: '🇳🇱', minDigits: 9, maxDigits: 9, placeholder: '6 12345678' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41', flag: '🇨🇭', minDigits: 9, maxDigits: 9, placeholder: '78 123 4567' },
  { name: 'New Zealand', code: 'NZ', dialCode: '+64', flag: '🇳🇿', minDigits: 8, maxDigits: 10, placeholder: '21 123 4567' },
  { name: 'Ireland', code: 'IE', dialCode: '+353', flag: '🇮🇪', minDigits: 9, maxDigits: 9, placeholder: '85 123 4567' },
  { name: 'Sweden', code: 'SE', dialCode: '+46', flag: '🇸🇪', minDigits: 9, maxDigits: 9, placeholder: '70 123 4567' },
];

/**
 * Find country by ISO code or dialCode
 */
export function getCountryByCode(codeOrDial: string): CountryData {
  const clean = codeOrDial.trim();
  const match = COUNTRIES.find(
    (c) => c.code.toLowerCase() === clean.toLowerCase() || c.dialCode === clean || c.name.toLowerCase() === clean.toLowerCase()
  );
  return match || COUNTRIES[0]; // Default to India (+91)
}

/**
 * Format country display label: e.g. "India (+91)"
 */
export function formatCountryLabel(country: CountryData): string {
  return `${country.name} (${country.dialCode})`;
}

/**
 * Validate phone number format for selected country
 * Supports either (phone, country) or (country, phone) parameter order.
 */
export function validatePhoneNumber(
  arg1: string | CountryData,
  arg2: CountryData | string
): { valid: boolean; error?: string } {
  const rawPhone = typeof arg1 === 'string' ? arg1 : typeof arg2 === 'string' ? arg2 : '';
  const country =
    typeof arg1 === 'object' && arg1 !== null
      ? (arg1 as CountryData)
      : typeof arg2 === 'object' && arg2 !== null
      ? (arg2 as CountryData)
      : COUNTRIES[0];

  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) {
    return { valid: false, error: 'Phone number cannot be empty.' };
  }
  if (digits.length < country.minDigits) {
    return {
      valid: false,
      error: `Phone number for ${country.name} must have at least ${country.minDigits} digits (entered ${digits.length}).`,
    };
  }
  if (digits.length > country.maxDigits) {
    return {
      valid: false,
      error: `Phone number for ${country.name} cannot exceed ${country.maxDigits} digits (entered ${digits.length}).`,
    };
  }
  return { valid: true };
}

