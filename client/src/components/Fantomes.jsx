// Formes fantômes : la forme de ce qui arrive, à la place d'un « Chargement… ».

// Une grille d'affiches (`n` cases).
export function GrilleFantome({ n = 9 }) {
  return (
    <div className="grid" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i}>
          <div className="skeleton skeleton--poster" />
          <div className="skeleton skeleton--line" />
        </div>
      ))}
    </div>
  );
}

// Une rangée d'affiches qui défile.
export function RangeeFantome({ n = 5 }) {
  return (
    <div className="rail" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div className="rail__item" key={i}>
          <div className="skeleton skeleton--poster" />
          <div className="skeleton skeleton--line" />
        </div>
      ))}
    </div>
  );
}

// Une rangée de puces.
export function PucesFantome({ n = 5 }) {
  return (
    <div className="chips-scroll" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="skeleton skeleton--puce" />
      ))}
    </div>
  );
}
