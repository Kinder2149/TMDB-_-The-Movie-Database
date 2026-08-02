import { useState } from 'react';

export default function SearchBar({ onSearch, disabled }) {
  const [value, setValue] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const query = value.trim();
    if (query) onSearch(query);
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Chercher un film ou une série…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Recherche"
      />
      <button type="submit" disabled={disabled}>
        Rechercher
      </button>
    </form>
  );
}
