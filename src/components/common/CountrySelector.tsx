import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { COUNTRIES, CountryData, formatCountryLabel } from '../../utils/countries';

interface CountrySelectorProps {
  selectedCountry: CountryData;
  onChange?: (country: CountryData) => void;
  onSelectCountry?: (country: CountryData) => void;
  className?: string;
  disabled?: boolean;
}

export const CountrySelector: React.FC<CountrySelectorProps> = ({
  selectedCountry,
  onChange,
  onSelectCountry,
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredCountries = COUNTRIES.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.dialCode.includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  });

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-full min-h-[42px] px-3 py-2 rounded-lg border border-fintech-border bg-white hover:bg-slate-50 transition-all flex items-center justify-between gap-1.5 text-xs sm:text-sm font-semibold text-fintech-navy focus:outline-none focus:ring-2 focus:ring-fintech-primary disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
        title="Select Country Calling Code"
      >
        <span className="flex items-center gap-1.5 truncate">
          <span className="text-base leading-none">{selectedCountry.flag}</span>
          <span className="truncate">{formatCountryLabel(selectedCountry)}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-fintech-muted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Searchable Dropdown Popup */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 sm:w-80 max-w-[90vw] bg-white rounded-xl shadow-elevated border border-fintech-border z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Box */}
          <div className="p-2.5 border-b border-fintech-border bg-slate-50/70">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-fintech-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country or code..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-fintech-border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-fintech-primary"
              />
            </div>
          </div>

          {/* Countries List */}
          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-100">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country) => {
                const isSelected = country.code === selectedCountry.code;
                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      if (onChange) onChange(country);
                      if (onSelectCountry) onSelectCountry(country);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-left text-xs flex items-center justify-between hover:bg-blue-50 transition-colors ${
                      isSelected ? 'bg-blue-50/80 font-bold text-fintech-primary' : 'text-fintech-text'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-base">{country.flag}</span>
                      <span className="truncate">{country.name}</span>
                      <span className="text-fintech-muted font-mono text-[11px]">({country.dialCode})</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-fintech-primary shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-fintech-muted">
                No matching country found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

