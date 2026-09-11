import { useState, useEffect, useRef } from 'react';
import { App as Capacitor } from '@capacitor/app';
import SearchBar from './components/SearchBar.jsx';
import MovieCard from './components/MovieCard.jsx';
import Detail from './components/Detail.jsx';
import Lists from './components/Lists.jsx';
import Tonight from './components/Tonight.jsx';
import Settings from './components/Settings.jsx';
import StatusMenu from './components/StatusMenu.jsx';
import CatalogLanguage from './components/CatalogLanguage.jsx';
import Icon from './components/Icon.jsx';
import About from './components/About.jsx';
import Backup from './components/Backup.jsx';
import Profiles from './components/Profiles.jsx';
import Stats from './components/Stats.jsx';
import Avatar from './components/Avatar.jsx';
import {
  searchTitles,
  searchByActor,
  getGenres,
  discoverGenre,
  getTrending,
  getSuggestions,
  getSuivi,
  addToSuivi,
  removeFromSuivi,
  setStatus as apiSetStatus,
  getProfiles,
  createProfile,
  renameProfile,
  setProfileAvatar,
  countProfileData,
  deleteProfile,
  getActiveProfileId,
  setActiveProfileId,
  hasCatalogLanguage,
  getCatalogLanguage,
  languageLabel,
  chooseInitialLanguage,
  changeCatalogLanguage,
  getListes,
  mettreAJourDatesDeSortie,
  createListe as apiCreateListe,
  deleteListe as apiDeleteListe,
  addToListe as apiAddToListe,
  removeFromListe as apiRemoveFromListe,
} from './api.js';

import {
  hasPendingChanges,
  sauvegardeAutomatique,
  sauvegardeAutoActive,
  surChangementDeSauvegarde,
} from './backup.js';

const keyOf = (item) => `${item.mediaType}-${item.id}`;

export default function App() {
  // 4 destinations, comme la barre de navigation du bas.
  const [view, setView] = useState('search'); // 'search' | 'tonight' | 'lists' | 'settings'
  // Onglets déjà visités, du plus ancien au plus récent (l'onglet affiché n'y
  // est pas). Le bouton retour d'Android dépile cette liste ; « Recherche »
  // est la racine : quand la pile est vide, le retour quitte l'application.
  const [tabStack, setTabStack] = useState([]);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [mediaFilter, setMediaFilter] = useState('all'); // all | movie | tv
  const [searchMode, setSearchMode] = useState('title'); // title | actor | genre
  const [person, setPerson] = useState(null); // acteur résolu (mode acteur)
  const [genres, setGenres] = useState([]); // [{ name, movieId, tvId }]
  const [trending, setTrending] = useState([]); // tendances (champ vide)
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [genrePage, setGenrePage] = useState(1);
  const [genreMore, setGenreMore] = useState(true);
  const searchSeq = useRef(0);
  // Suivi complet : clé -> item (avec status et listStatus).
  const [suivi, setSuivi] = useState(() => new Map());
  const [openDetail, setOpenDetail] = useState(null);
  // Titre dont le menu de statuts (appui long) est ouvert.
  const [statusMenu, setStatusMenu] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [showStats, setShowStats] = useState(false);
  // Écran ouvert par-dessus un onglet (ex. « Ajouter des titres » dans une
  // liste) : il possède son propre état, mais c'est ici qu'on sait dans quel
  // ordre le bouton retour doit fermer les choses.
  const [surcouche, setSurcouche] = useState(null);
  // Rappel de sauvegarde cloud. Google réaffichant son écran de compte à
  // chaque autorisation, une sauvegarde ne peut pas partir sans un geste :
  // on le demande une fois, au lancement, plutôt que d'interrompre en pleine
  // utilisation. Écarté d'un geste, il ne revient pas de la session.
  const [rappelSauvegarde, setRappelSauvegarde] = useState(hasPendingChanges);
  // Langue du catalogue : tant qu'elle n'a jamais été choisie, l'écran de
  // bienvenue s'affiche avant tout le reste.
  const [needLanguage, setNeedLanguage] = useState(() => !hasCatalogLanguage());
  const [catalogLang, setCatalogLang] = useState(() => getCatalogLanguage());
  const [showLanguage, setShowLanguage] = useState(false);
  // Profils : la liste et l'id actif. Tant qu'aucun profil n'est prêt, on ne
  // lance aucune opération de suivi (elles sont toujours scopées par profil).
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(getActiveProfileId());
  // Thème clair / sombre (posé sur <html> par main.jsx au démarrage).
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'dark'
  );

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* localStorage indisponible : le thème reste juste pour la session */
    }
  }

  const [listes, setListes] = useState([]);
  // Sous-onglet actif de « Ce soir ». Mémorisé tant que l'application tourne
  // (on retrouve son sous-onglet en revenant depuis un autre onglet), mais
  // jamais enregistré : à la réouverture on repart toujours d'« En attente ».
  const [tonightTab, setTonightTab] = useState('attente');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  function loadSuivi() {
    getSuivi()
      .then((items) => setSuivi(new Map(items.map((i) => [keyOf(i), i]))))
      .catch(() => {});
  }

  function loadListes() {
    getListes().then(setListes).catch(() => {});
  }

  function loadSuggestions() {
    setSuggestionsLoading(true);
    getSuggestions()
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false));
  }

  // Au démarrage : charger les profils et fixer le profil actif.
  // Si l'id mémorisé (localStorage) n'existe plus, on prend le premier profil.
  useEffect(() => {
    getProfiles()
      .then((list) => {
        setProfiles(list);
        const stored = getActiveProfileId();
        const chosen = list.find((p) => p.id === stored) || list[0];
        if (chosen) {
          setActiveProfileId(chosen.id);
          setActiveProfile(chosen.id);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  // Recharger le suivi dès qu'un profil actif est disponible / change.
  useEffect(() => {
    if (activeProfile) {
      loadSuivi();
      loadListes();
    }
  }, [activeProfile]);

  // Rattrapage silencieux, une fois par lancement. Deux cas :
  //   - les fiches d'avant que l'application ne retienne la date de sortie,
  //     qui n'en avaient aucune (sans date, un film à venir passe pour sorti) ;
  //   - celles dont la date vient d'un autre pays que la langue choisie.
  // On complète, puis on recharge — sinon l'écran garderait l'ancienne liste.
  // En cas de coupure réseau, on ne dit rien : ce sera retenté au prochain
  // lancement, et l'application marche exactement comme avant en attendant.
  useEffect(() => {
    if (!activeProfile) return;
    mettreAJourDatesDeSortie()
      .then((completees) => {
        if (completees > 0) loadSuivi();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile]);

  // Genres et tendances chargés une fois (indépendants du profil).
  useEffect(() => {
    getGenres().then(setGenres).catch(() => {});
    getTrending().then(setTrending).catch(() => {});
  }, []);

  // En mode genre, changer le filtre Films/Séries relance la découverte.
  // Si le genre sélectionné n'existe pas pour le nouveau filtre (ex. « Action »
  // en filtre Séries), on désélectionne plutôt que d'afficher une liste vide.
  useEffect(() => {
    if (searchMode !== 'genre' || !selectedGenre) return;
    const stillValid =
      mediaFilter === 'movie'
        ? !!selectedGenre.movieId
        : mediaFilter === 'tv'
        ? !!selectedGenre.tvId
        : true;
    if (!stillValid) {
      setSelectedGenre(null);
      setResults([]);
      setHasSearched(false);
      setStatus('idle');
      return;
    }
    runDiscover(selectedGenre, mediaFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaFilter]);

  function handleSelectProfile(id) {
    setActiveProfileId(id);
    setActiveProfile(id);
    setOpenDetail(null); // la fiche ouverte appartenait à l'ancien profil
  }

  async function handleCreateProfile(name) {
    try {
      const created = await createProfile(name);
      setProfiles((prev) => [...prev, created]);
      handleSelectProfile(created.id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleRenameProfile(id, name) {
    try {
      await renameProfile(id, name);
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSetProfileAvatar(id, avatar) {
    try {
      await setProfileAvatar(id, avatar);
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, avatar } : p)));
    } catch (e) {
      setError(e.message);
    }
  }

  // Supprimer un profil : la base rend l'id du profil sur lequel se rabattre.
  // Si c'était le profil affiché, on bascule dessus — sinon l'écran resterait
  // branché sur des données qui n'existent plus.
  async function handleDeleteProfile(id) {
    const repli = await deleteProfile(id);
    const restants = await getProfiles();
    setProfiles(restants);
    if (id === activeProfile) handleSelectProfile(repli);
  }

  // Après restauration d'une sauvegarde : le profil restauré devient l'actif et
  // tout ce qui est affiché est rechargé depuis la base (le contenu a changé).
  async function handleRestored(id) {
    try {
      setProfiles(await getProfiles());
      handleSelectProfile(id);
      await loadSuivi();
      loadListes();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSearch(query) {
    const seq = ++searchSeq.current;
    if (!query) {
      setResults([]);
      setPerson(null);
      setStatus('idle');
      setHasSearched(false);
      return;
    }
    setStatus('loading');
    setError('');
    setHasSearched(true);
    try {
      if (searchMode === 'actor') {
        const { person: found, results: credits } = await searchByActor(query);
        if (seq === searchSeq.current) {
          setPerson(found);
          setResults(credits);
          setStatus('done');
        }
      } else {
        const found = await searchTitles(query);
        if (seq === searchSeq.current) {
          setPerson(null);
          setResults(found);
          setStatus('done');
        }
      }
    } catch (err) {
      // On ignore les réponses dépassées (frappe rapide).
      if (seq === searchSeq.current) {
        setError(err.message);
        setStatus('error');
      }
    }
  }

  // Change de mode de recherche en repartant d'un état propre.
  function changeMode(mode) {
    setSearchMode(mode);
    setSelectedGenre(null);
    setPerson(null);
    setResults([]);
    setHasSearched(false);
    setStatus('idle');
  }

  async function runDiscover(genre, filter, page = 1, append = false) {
    const seq = ++searchSeq.current;
    setError('');
    setHasSearched(true);
    setPerson(null);
    const params = { page };
    if ((filter === 'all' || filter === 'movie') && genre.movieId)
      params.movieGenre = genre.movieId;
    if ((filter === 'all' || filter === 'tv') && genre.tvId)
      params.tvGenre = genre.tvId;

    // Genre inexistant pour ce filtre (ex. « Horreur » en séries) : liste vide.
    if (!params.movieGenre && !params.tvGenre) {
      setResults([]);
      setGenreMore(false);
      setStatus('done');
      return;
    }
    if (!append) setStatus('loading');
    try {
      const found = await discoverGenre(params);
      if (seq !== searchSeq.current) return;
      setGenrePage(page);
      setGenreMore(found.length > 0);
      setResults((prev) => {
        if (!append) return found;
        const seen = new Set(prev.map((r) => `${r.mediaType}-${r.id}`));
        return [...prev, ...found.filter((r) => !seen.has(`${r.mediaType}-${r.id}`))];
      });
      setStatus('done');
    } catch (err) {
      if (seq === searchSeq.current) {
        setError(err.message);
        setStatus('error');
      }
    }
  }

  function selectGenre(genre) {
    setSelectedGenre(genre);
    setGenrePage(1);
    setGenreMore(true);
    runDiscover(genre, mediaFilter, 1, false);
  }

  async function handleToggleFollow(item) {
    const key = keyOf(item);
    try {
      if (suivi.has(key)) {
        await removeFromSuivi(item.mediaType, item.id);
      } else {
        await addToSuivi(item);
      }
      loadSuivi();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSetStatus(item, newStatus) {
    try {
      await apiSetStatus(item.mediaType, item.id, newStatus);
      loadSuivi();
    } catch (err) {
      setError(err.message);
    }
  }

  // Statut choisi dans le menu d'appui long. Le titre peut venir d'une
  // recherche : dans ce cas on l'ajoute au suivi avant de poser le statut,
  // sinon choisir « Vu » sur un titre pas encore suivi ne ferait rien.
  async function handlePickStatus(item, newStatus) {
    setStatusMenu(null);
    try {
      if (!suivi.has(keyOf(item))) await addToSuivi(item);
      await apiSetStatus(item.mediaType, item.id, newStatus);
      loadSuivi();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveFromSuivi(item) {
    setStatusMenu(null);
    try {
      await removeFromSuivi(item.mediaType, item.id);
      loadSuivi();
    } catch (err) {
      setError(err.message);
    }
  }

  // Premier choix de langue (écran de bienvenue).
  async function applyInitialLanguage(value, onProgress) {
    const res = await chooseInitialLanguage(value, onProgress);
    setCatalogLang(value);
    setNeedLanguage(false);
    loadSuivi();
    return res;
  }

  // Changement depuis les réglages : les fiches enregistrées sont re-téléchargées.
  async function applyLanguageChange(value, onProgress) {
    const res = await changeCatalogLanguage(value, onProgress);
    setCatalogLang(value);
    loadSuivi(); // les titres et affiches en base ont changé
    setSuggestions([]); // recalculées dans la nouvelle langue au prochain passage
    setResults([]);
    setTrending([]);
    getTrending().then(setTrending).catch(() => {});
    getGenres().then(setGenres).catch(() => {});
    return res;
  }

  async function handleCreateListe(name) {
    try {
      const created = await apiCreateListe(name);
      loadListes();
      return created;
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteListe(id) {
    try {
      await apiDeleteListe(id);
      loadListes();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddToListe(listeId, item) {
    try {
      await apiAddToListe(listeId, item);
      loadListes();
      loadSuivi(); // ajouter à une liste ajoute aussi au suivi
    } catch (err) {
      setError(err.message);
    }
  }

  // Ajout groupé depuis l'écran « Ajouter des titres ». Les titres viennent
  // déjà du suivi : on les pose dans la liste, puis on rafraîchit une seule
  // fois plutôt qu'à chaque titre.
  async function handleAddManyToListe(listeId, items) {
    try {
      for (const item of items) await apiAddToListe(listeId, item);
      loadListes();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveFromListe(listeId, item) {
    try {
      await apiRemoveFromListe(listeId, item.mediaType, item.id);
      loadListes();
    } catch (err) {
      setError(err.message);
    }
  }

  // Bouton « retour » d'Android. Il se comporte comme les flèches de retour de
  // l'interface : il ferme d'abord ce qui est ouvert par-dessus (sauvegarde,
  // à propos, fiche), puis dépile les onglets dans l'ordre où on les a
  // consultés, et ne quitte que depuis l'accueil.
  //
  // Ce que fait l'appui est recalculé à chaque rendu et rangé dans `backRef` ;
  // l'écoute, elle, n'est posée qu'une seule fois (au démarrage). C'est
  // volontaire : la pose d'une écoute Capacitor est asynchrone, donc
  // réinstaller l'écoute à chaque changement d'écran retirait l'ancienne
  // *avant* qu'elle ne soit réellement posée. Les écoutes périmées
  // s'accumulaient, chacune figée sur l'état qu'elle avait vu ; celle restée
  // sur la photo de l'accueil quittait l'application, quel que soit l'écran
  // réellement affiché.
  const backRef = useRef(null);
  backRef.current = () => {
    if (showLanguage) setShowLanguage(false);
    else if (statusMenu) setStatusMenu(null);
    else if (showStats) setShowStats(false);
    else if (showProfiles) setShowProfiles(false);
    else if (surcouche) surcouche.fermer();
    else if (showBackup) setShowBackup(false);
    else if (showAbout) setShowAbout(false);
    else if (openDetail) closeDetail();
    else if (tabStack.length > 0) goBackTab();
    else if (view !== 'search') goTo('search', { push: false });
    else {
      // Dernière chance avant de quitter. On ne l'attend pas : faire patienter
      // devant un écran figé serait pire que de rater un envoi, que le bandeau
      // rattrapera de toute façon au prochain lancement.
      autoSauvegardeRef.current();
      Capacitor.exitApp();
    }
  };

  useEffect(() => {
    let handle = null;
    let annule = false; // démontage avant la fin de la pose : on retire quand même
    Capacitor.addListener('backButton', () => backRef.current()).then((h) => {
      handle = h;
      if (annule) h.remove();
    });
    return () => {
      annule = true;
      handle?.remove();
    };
  }, []);

  // Sauvegarde automatique dans le Drive.
  //
  // Deux moments : quand on quitte l'application (le plus utile — c'est là
  // qu'on risque de perdre ce qu'on vient de faire), et quand on y revient si
  // la précédente n'a pas abouti. Elle ne part que s'il y a du nouveau, et
  // n'affiche jamais rien : sans compte Google relié ou sans autorisation
  // valide, elle renonce en silence et le bandeau reste.
  //
  // Même précaution que pour le bouton retour : l'écoute est posée **une seule
  // fois**, et va lire l'état courant au moment où elle se déclenche.
  const autoSauvegardeRef = useRef(() => {});
  autoSauvegardeRef.current = async () => {
    const resultat = await sauvegardeAutomatique();
    if (resultat.fait) setRappelSauvegarde(false);
    else setRappelSauvegarde(hasPendingChanges());
  };

  // Le bandeau suit l'état réel, en direct. Avant, il n'était lu qu'au
  // lancement : on pouvait cocher dix épisodes sans jamais voir apparaître
  // « pas encore sauvegardé ».
  useEffect(() => surChangementDeSauvegarde(setRappelSauvegarde), []);

  // Rattrapage au lancement. Indispensable et pas redondant avec l'écoute
  // ci-dessous : quand Android supprime l'application de la mémoire — ce qu'il
  // fait souvent dès qu'on la quitte — la réouverture est un **démarrage à
  // froid**, et `appStateChange` ne se déclenche pas. Sans ce rattrapage, une
  // sauvegarde coupée en partant n'était jamais reprise, et le bandeau restait
  // indéfiniment.
  useEffect(() => {
    if (!activeProfile) return;
    autoSauvegardeRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile]);

  useEffect(() => {
    let handle = null;
    let annule = false;
    Capacitor.addListener('appStateChange', () => {
      // On tente dans les deux sens : en partant (au cas où l'application ne
      // serait pas rouverte de sitôt) et en revenant (là, on a tout le temps
      // de finir l'envoi).
      autoSauvegardeRef.current();
    }).then((h) => {
      handle = h;
      if (annule) h.remove();
    });
    return () => {
      annule = true;
      handle?.remove();
    };
  }, []);

  // À la fermeture de la fiche, on recharge : cocher des épisodes / marquer vu
  // a pu faire passer le titre d'une liste à l'autre.
  function closeDetail() {
    setOpenDetail(null);
    loadSuivi();
  }

  const cardProps = {
    onToggleFollow: handleToggleFollow,
    onSetStatus: handleSetStatus,
    onOpenDetail: setOpenDetail,
    onLongPress: setStatusMenu,
  };

  const filteredResults =
    mediaFilter === 'all'
      ? results
      : results.filter((r) => r.mediaType === mediaFilter);

  // Certains genres TMDB n'existent que côté films ou que côté séries
  // (ex. « Action » n'a pas d'équivalent séries, qui a « Action & Aventure »).
  // On ne propose que les genres valides pour le filtre Films/Séries actif,
  // sinon le clic donnerait toujours une liste vide.
  const availableGenres = genres.filter((g) => {
    if (mediaFilter === 'movie') return !!g.movieId;
    if (mediaFilter === 'tv') return !!g.tvId;
    return !!(g.movieId || g.tvId);
  });

  // Écran de recherche à vide (titre / acteur, avant toute frappe) : on propose
  // les tendances plutôt qu'un écran vide.
  const isDefault = searchMode !== 'genre' && !hasSearched;
  const trendingFiltered =
    mediaFilter === 'all'
      ? trending
      : trending.filter((r) => r.mediaType === mediaFilter);

  // Passage d'un onglet à l'autre : on rafraîchit les données dont il a besoin.
  // `push` alimente l'historique de navigation ; on le laisse à false quand
  // c'est justement le retour qui nous amène là (sinon on tournerait en rond).
  function goTo(next, { push = true } = {}) {
    if (next === view) return;
    // Pile bornée : un aller-retour répété entre deux onglets ne doit pas
    // obliger à appuyer trente fois sur retour pour sortir.
    if (push) setTabStack((prev) => [...prev, view].slice(-10));
    showTab(next);
  }

  // Revient à l'onglet précédemment consulté (retour Android).
  function goBackTab() {
    const prev = tabStack[tabStack.length - 1];
    setTabStack((s) => s.slice(0, -1));
    showTab(prev);
  }

  function showTab(next) {
    setView(next);
    if (next === 'tonight' || next === 'lists') loadSuivi();
    if (next === 'tonight') loadSuggestions();
  }

  // Premier lancement : on demande la langue du catalogue avant d'entrer.
  if (needLanguage) {
    return (
      <CatalogLanguage current={null} onApply={applyInitialLanguage} welcome />
    );
  }

  return (
    <div className="app">
      <header className="appbar">
        <span className="brand__dot" aria-hidden="true"></span>
        <span className="brand__name">Vault Watch</span>
        <button
          className="appbar__profile"
          onClick={() => goTo('settings')}
          title="Profil et réglages"
          aria-label="Profil et réglages"
        >
          <Avatar
            name={profiles.find((p) => p.id === activeProfile)?.name}
            value={profiles.find((p) => p.id === activeProfile)?.avatar}
            size={32}
          />
        </button>
      </header>

      {rappelSauvegarde && !showBackup && (
        <div className="rappel">
          <span>
            Des modifications ne sont pas encore sauvegardées
            {sauvegardeAutoActive()
              ? " — elles partiront quand tu quitteras l'application."
              : '.'}
          </span>
          <button className="btn" onClick={() => setShowBackup(true)}>
            Sauvegarder
          </button>
          <button
            className="rappel__fermer"
            onClick={() => setRappelSauvegarde(false)}
            aria-label="Masquer le rappel"
          >
            ×
          </button>
        </div>
      )}

      <main className="content">

      {view === 'search' && (
        <>
          {/* Le champ de recherche d'abord : c'est ce pour quoi on ouvre l'écran.
              Les modes et les filtres viennent ensuite, pas l'inverse. */}
          {searchMode !== 'genre' && (
            <SearchBar
              onSearch={handleSearch}
              mode={searchMode}
              placeholder={
                searchMode === 'actor'
                  ? 'Chercher un acteur…'
                  : 'Chercher un film ou une série…'
              }
            />
          )}

          <div className="seg" aria-label="Chercher par">
            {[
              ['title', 'Titre'],
              ['actor', 'Acteur'],
              ['genre', 'Genre'],
            ].map(([v, label]) => (
              <button
                key={v}
                className={searchMode === v ? 'on' : ''}
                onClick={() => changeMode(v)}
              >
                {label}
              </button>
            ))}
          </div>

          {searchMode === 'genre' && (
            <div className="genre-picker">
              {genres.map((g) => {
                const available = availableGenres.includes(g);
                return (
                  <button
                    key={g.name}
                    className={`chip ${selectedGenre?.name === g.name ? 'on' : ''} ${
                      available ? '' : 'chip--disabled'
                    }`}
                    disabled={!available}
                    onClick={() => selectGenre(g)}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          )}

          {hasSearched && (
            <div className="seg">
              {[
                ['all', 'Tout'],
                ['movie', 'Films'],
                ['tv', 'Séries'],
              ].map(([v, label]) => (
                <button
                  key={v}
                  className={mediaFilter === v ? 'on' : ''}
                  onClick={() => setMediaFilter(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {searchMode === 'actor' && person && (
            <div className="actor-head">
              {person.photoUrl && <img src={person.photoUrl} alt={person.name} />}
              <span>
                Films &amp; séries avec <b>{person.name}</b>
              </span>
            </div>
          )}

          {searchMode === 'genre' && selectedGenre && (
            <div className="actor-head">
              <span>
                Genre : <b>{selectedGenre.name}</b>
              </span>
            </div>
          )}

          {status === 'loading' && <p className="hint">Recherche en cours…</p>}
          {status === 'error' && <p className="error">{error}</p>}
          {status === 'done' &&
            hasSearched &&
            searchMode === 'actor' &&
            !person && <p className="hint">Aucun acteur trouvé.</p>}
          {status === 'done' &&
            hasSearched &&
            filteredResults.length === 0 &&
            !(searchMode === 'actor' && !person) && (
              <p className="hint">Aucun résultat.</p>
            )}

          {isDefault && trendingFiltered.length > 0 && (
            <>
              <div className="sechead">
                <h3>✨ Tendances de la semaine</h3>
              </div>
              <section className="grid">
                {trendingFiltered.map((item) => (
                  <MovieCard
                    key={keyOf(item)}
                    item={item}
                    isFollowed={suivi.has(keyOf(item))}
                    status={suivi.get(keyOf(item))?.status}
                    {...cardProps}
                  />
                ))}
              </section>
            </>
          )}

          <section className="grid">
            {filteredResults.map((item) => (
              <MovieCard
                key={keyOf(item)}
                item={item}
                isFollowed={suivi.has(keyOf(item))}
                status={suivi.get(keyOf(item))?.status}
                {...cardProps}
              />
            ))}
          </section>

          {searchMode === 'genre' &&
            selectedGenre &&
            genreMore &&
            status === 'done' &&
            filteredResults.length > 0 && (
              <div className="voirplus">
                <button
                  className="btn btn--ghost"
                  onClick={() =>
                    runDiscover(selectedGenre, mediaFilter, genrePage + 1, true)
                  }
                >
                  Voir plus
                </button>
              </div>
            )}
        </>
      )}

      {view === 'lists' && (
        <Lists
          items={Array.from(suivi.values())}
          listes={listes}
          onCreateListe={handleCreateListe}
          onDeleteListe={handleDeleteListe}
          onAddManyToListe={handleAddManyToListe}
          onSurcouche={setSurcouche}
          {...cardProps}
        />
      )}

      {view === 'tonight' && (
        <Tonight
          items={Array.from(suivi.values())}
          cardProps={cardProps}
          suggestions={suggestions}
          suggestionsLoading={suggestionsLoading}
          onRefreshSuggestions={loadSuggestions}
          subTab={tonightTab}
          onSubTab={setTonightTab}
        />
      )}

      {view === 'settings' && (
        <Settings
          profiles={profiles}
          activeProfile={activeProfile}
          onOpenProfiles={() => setShowProfiles(true)}
          onOpenStats={() => setShowStats(true)}
          onSelectProfile={handleSelectProfile}
          theme={theme}
          onToggleTheme={toggleTheme}
          catalogLang={catalogLang}
          catalogLangLabel={languageLabel(catalogLang)}
          onOpenLanguage={() => setShowLanguage(true)}
          onOpenBackup={() => setShowBackup(true)}
          onOpenAbout={() => setShowAbout(true)}
          suiviCount={suivi.size}
        />
      )}
      </main>

      <nav className="tabbar">
        {[
          ['search', 'Recherche', 'search'],
          ['tonight', 'Ce soir', 'film'],
          ['lists', 'Mes listes', 'lists'],
          ['settings', 'Réglages', 'gear'],
        ].map(([v, label, icon]) => (
          <button
            key={v}
            className={view === v ? 'is-active' : ''}
            onClick={() => goTo(v)}
            aria-current={view === v ? 'page' : undefined}
          >
            <Icon name={icon} size={22} />
            {label}
          </button>
        ))}
      </nav>

      {openDetail && (
        <Detail
          // Passer d'un film de la saga à un autre repart d'une fiche neuve
          // (note, listes, épisodes, défilement en haut).
          key={keyOf(openDetail)}
          item={openDetail}
          suivi={suivi}
          cardProps={cardProps}
          isFollowed={suivi.has(keyOf(openDetail))}
          status={suivi.get(keyOf(openDetail))?.status}
          listes={listes}
          onToggleFollow={handleToggleFollow}
          onSetStatus={handleSetStatus}
          onCreateListe={handleCreateListe}
          onAddToListe={handleAddToListe}
          onRemoveFromListe={handleRemoveFromListe}
          onClose={closeDetail}
        />
      )}

      {showStats && <Stats onClose={() => setShowStats(false)} />}

      {showProfiles && (
        <Profiles
          profiles={profiles}
          activeId={activeProfile}
          onSelect={(id) => {
            handleSelectProfile(id);
            setShowProfiles(false);
          }}
          onCreate={handleCreateProfile}
          onRename={handleRenameProfile}
          onSetAvatar={handleSetProfileAvatar}
          onCountData={countProfileData}
          onDelete={handleDeleteProfile}
          onClose={() => setShowProfiles(false)}
        />
      )}

      {showBackup && activeProfile && (
        <Backup
          profileId={activeProfile}
          profileName={profiles.find((p) => p.id === activeProfile)?.name || 'Mon profil'}
          onRestored={handleRestored}
          onClose={() => {
            setShowBackup(false);
            setRappelSauvegarde(hasPendingChanges());
          }}
        />
      )}

      {showAbout && <About onClose={() => setShowAbout(false)} />}

      {showLanguage && (
        <CatalogLanguage
          current={catalogLang}
          onApply={applyLanguageChange}
          onClose={() => setShowLanguage(false)}
        />
      )}

      {statusMenu && (
        <StatusMenu
          item={statusMenu}
          isFollowed={suivi.has(keyOf(statusMenu))}
          status={suivi.get(keyOf(statusMenu))?.status}
          onPick={handlePickStatus}
          onRemove={handleRemoveFromSuivi}
          onClose={() => setStatusMenu(null)}
        />
      )}
    </div>
  );
}
