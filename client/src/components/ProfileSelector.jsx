// Sélecteur de profil (couche UI). Permet de choisir, créer et renommer un profil.
// Reste volontairement simple : pas de mot de passe, tout est local en V1.
export default function ProfileSelector({
  profiles,
  activeId,
  onSelect,
  onCreate,
  onRename,
}) {
  const active = profiles.find((p) => p.id === activeId);

  function handleChange(e) {
    if (e.target.value === '__new__') {
      const name = window.prompt('Nom du nouveau profil ?');
      if (name && name.trim()) onCreate(name.trim());
      return;
    }
    onSelect(e.target.value);
  }

  function handleRename() {
    const name = window.prompt('Nouveau nom du profil ?', active?.name || '');
    if (name && name.trim()) onRename(activeId, name.trim());
  }

  return (
    <div className="profile-selector">
      <label className="profile-selector__label">Profil</label>
      <select
        className="profile-selector__select"
        value={activeId || ''}
        onChange={handleChange}
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        <option value="__new__">+ Nouveau profil…</option>
      </select>
      <button
        className="profile-selector__rename"
        onClick={handleRename}
        disabled={!activeId}
        title="Renommer le profil"
      >
        Renommer
      </button>
    </div>
  );
}
