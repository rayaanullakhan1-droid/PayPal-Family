export interface LanguageMeta {
  code: string;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
  region?: string;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', region: 'Global' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr', region: 'India' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', dir: 'ltr', region: 'Karnataka, India' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl', region: 'South Asia' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', dir: 'ltr', region: 'Tamil Nadu, India' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', dir: 'ltr', region: 'Andhra/Telangana, India' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', dir: 'ltr', region: 'Kerala, India' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', dir: 'ltr', region: 'Maharashtra, India' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', dir: 'ltr', region: 'West Bengal / Bangladesh' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', dir: 'ltr', region: 'Gujarat, India' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', dir: 'ltr', region: 'Punjab, India' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr', region: 'Spain & Latin America' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', region: 'France & Francophonie' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', region: 'Middle East & North Africa' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr', region: 'Germany, Austria, Switzerland' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr', region: 'Portugal & Brazil' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', dir: 'ltr', region: 'Japan' },
  { code: 'zh', name: 'Chinese', nativeName: '中文 (简体)', dir: 'ltr', region: 'China & Global' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', dir: 'ltr', region: 'Italy & Switzerland' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr', region: 'Eastern Europe & Eurasia' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', dir: 'ltr', region: 'Turkey & Cyprus' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', dir: 'ltr', region: 'Indonesia' },
];

export function getLanguageMeta(code: string): LanguageMeta {
  const clean = code.toLowerCase().trim();
  const match = SUPPORTED_LANGUAGES.find((l) => l.code === clean);
  return match || SUPPORTED_LANGUAGES[0]; // fallback to English
}

