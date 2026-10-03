// Grande carte d'accueil : l'affiche du titre, floutée et assombrie, en fond. Sans affiche,
// un dégradé dont la teinte vient du titre (toujours la même pour un titre donné).
function teinte(texte) {
  let h = 0;
  for (let i = 0; i < texte.length; i++) h = (h * 31 + texte.charCodeAt(i)) % 360;
  return h;
}

export default function Hero({ fond, titre, kicker, sous, children }) {
  const style = fond
    ? undefined
    : { background: `linear-gradient(135deg, hsl(${teinte(titre || '')} 38% 26%), hsl(${(teinte(titre || '') + 50) % 360} 42% 14%))` };
  return (
    <section className="hero" style={style}>
      {fond && <img className="hero__fond" src={fond} alt="" loading="lazy" aria-hidden="true" />}
      <div className="hero__voile" />
      <div className="hero__corps">
        {kicker && <p className="hero__kicker">{kicker}</p>}
        <h3 className="hero__titre">{titre}</h3>
        {sous && <p className="hero__sous">{sous}</p>}
        {children && <div className="hero__actions">{children}</div>}
      </div>
    </section>
  );
}
