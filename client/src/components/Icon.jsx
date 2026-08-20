// Jeu d'icônes dessinées au trait.
// Volontairement pas d'émojis : leur rendu dépend de la police du téléphone
// (sur Android certains symboles s'affichaient en carré vide).
const PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  film: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 12h18M3 8h4M3 16h4M17 8h4M17 16h4" />
    </>
  ),
  lists: <path d="M2 5h10M2 12h10M2 19h10M16 4v9l3-2 3 2V4" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 7l1.9 1.1M17.9 15.9l1.9 1.1M4.2 17l1.9-1.1M17.9 8.1 19.8 7" />
    </>
  ),
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4" />
    </>
  ),
  save: <><path d="M5 4h11l4 4v12H5z" /><path d="M8 4v5h7M8 20v-6h8v6" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.6v.2" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 13 4.5 4.5L19 7" />,
  play: <path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="M15 5 8 12l7 7" />,
};

export default function Icon({ name, size = 22, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
