import { useState, useEffect } from 'react';
import Icon from './Icon.jsx';

// Recherche instantanée : on lance la recherche au fil de la frappe (avec un
// court délai). Change aussi de mode (titre / acteur) sans re-taper.
export default function SearchBar({ onSearch, mode = 'title', placeholder }) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const query = value.trim();
    const timer = setTimeout(() => onSearch(query), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mode]);

  return (
    <div className="search-bar">
      <span className="search-bar__icon" aria-hidden="true">
        <Icon name="search" size={18} />
      </span>
      <input
        type="text"
        placeholder={placeholder || 'Chercher…'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Recherche"
      />
    </div>
  );
}
