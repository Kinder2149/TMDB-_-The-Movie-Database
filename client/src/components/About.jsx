// Écran « À propos ». Porte la mention d'attribution TMDB, qui est une
// **obligation** de leurs conditions d'utilisation (voir PLAN_ANDROID.md) :
// la phrase ci-dessous doit figurer telle quelle, en anglais, et le logo TMDB
// doit être affiché moins en évidence que le nôtre.
export default function About({ onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <h2>À propos</h2>
          <button className="sheet__close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>

        <div className="detail-pad about">
          <p className="about__lead">
            <strong>Suivi Films &amp; Séries</strong> — application personnelle de suivi
            de films et de séries.
          </p>

          <h3 className="about__title">Vos données</h3>
          <p>
            Tout est enregistré <strong>sur cet appareil uniquement</strong> : profils,
            suivi, épisodes vus et listes. Rien n'est envoyé sur un serveur, et
            l'application ne crée aucun compte.
          </p>
          <p className="about__warn">
            Pensez à faire une sauvegarde : si vous perdez l'appareil, vous perdez
            votre suivi.
          </p>

          <h3 className="about__title">Source des données</h3>
          <p>
            Les fiches, affiches, castings et disponibilités proviennent de{' '}
            <strong>TMDB</strong>. Les disponibilités en streaming sont fournies par
            JustWatch via TMDB.
          </p>

          <div className="about__tmdb">
            {/* Logo officiel TMDB (public/tmdb-logo.svg, récupéré sur
                themoviedb.org/about/logos-attribution). Affiché volontairement
                petit : TMDB impose que leur marque soit moins en évidence que
                celle de l'application. */}
            <img
              className="about__tmdb-logo"
              src="/tmdb-logo.svg"
              alt="The Movie Database (TMDB)"
              width="84"
              height="36"
            />
            <p className="about__legal">
              This application uses TMDB and the TMDB APIs but is not endorsed,
              certified, or otherwise approved by TMDB.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
