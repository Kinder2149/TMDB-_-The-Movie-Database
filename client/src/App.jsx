import { useState, useEffect, useRef } from 'react';
import { App as Capacitor } from '@capacitor/app';
import SearchBar from './components/SearchBar.jsx';
import MovieCard from './components/MovieCard.jsx';
import Detail from './components/Detail.jsx';
import Lists from './components/Lists.jsx';
import Rubriques from './components/Rubriques.jsx';
import Partage from './components/Partage.jsx';
import Amis from './components/Amis.jsx';
import Decouvrir from './components/Decouvrir.jsx';
import Tonight from './components/Tonight.jsx';
import Settings from './components/Settings.jsx';
import StatusMenu from './components/StatusMenu.jsx';
import CatalogLanguage from './components/CatalogLanguage.jsx';
import Filtres from './components/Filtres.jsx';
import Icon from './components/Icon.jsx';
import About from './components/About.jsx';
import Backup from './components/Backup.jsx';
import Notifications from './components/Notifications.jsx';
import Profiles from './components/Profiles.jsx';
import Stats from './components/Stats.jsx';
import Avatar from './components/Avatar.jsx';
import Vide from './components/Vide.jsx';
import HorsLigne from './components/HorsLigne.jsx';
import { GrilleFantome } from './components/Fantomes.jsx';
import { estErreurReseau } from './reseau.js';
import { vibre } from './tactile.js';
import { lireChoix, appliquer as appliquerTheme } from './theme.js';
import {
  searchTitles,
  searchByActor,
  getActorFilmography,
  getRecommendations,
  getGenres,
  discoverGenre,
  getPlateformes,
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
  verifierNotifications,
  notifierSortiesDues,
  createListe as apiCreateListe,
  deleteListe as apiDeleteListe,
  setListePrive as apiSetListePrive,
  getPartage,
  publierPartageAuto,
  partageDisponible,
  addToListe as apiAddToListe,
  removeFromListe as apiRemoveFromListe,
} from './api.js';

import {
  hasPendingChanges,
  sauvegardeAutomatique,
  sauvegardeAutoActive,
  surChangementDeSauvegarde,
} from './backup.js';

import {
  FILTRES_VIDES,
  FILTRES_BIBLIO_VIDES,
  filtresActifs,
  appliquerFiltres,
} from './filtres.js';

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
  const derniereRecherche = useRef('');
  const [erreurReseau, setErreurReseau] = useState(false);
  const [genres, setGenres] = useState([]); // [{ key, name }] — liste unique films + séries
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [genrePage, setGenrePage] = useState(1);
  const [genreMore, setGenreMore] = useState(true);
  const searchSeq = useRef(0);
  // Fiche d'où l'on est parti en touchant un acteur, et l'onglet où elle était
  // ouverte : le retour (bouton ou geste Android) la rouvre. Effacée dès qu'on
  // fait autre chose (nouvel onglet, nouvelle recherche).
  const [ficheOrigine, setFicheOrigine] = useState(null); // { item, view }
  // La barre de recherche lance une recherche *vide* dès qu'elle change de mode
  // ou se recrée, ce qui viderait la filmographie qu'on vient d'afficher. Tant
  // que cette filmographie est à l'écran, on ignore cette recherche vide ; la
  // barre est recréée (`barreCle`) pour ne pas rejouer un ancien texte tapé.
  const acteurParFiche = useRef(false);
  const [barreCle, setBarreCle] = useState(0);
  // Filtres de la recherche (Titre, Acteur, Explorer) : période, tri et,
  // dans Explorer seulement, plateformes. Remis à zéro à chaque changement de mode.
  const [filtres, setFiltres] = useState(FILTRES_VIDES);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [plateformes, setPlateformes] = useState([]);
  // Suivi complet : clé -> item (avec status et listStatus).
  const [suivi, setSuivi] = useState(() => new Map());
  const [openDetail, setOpenDetail] = useState(null);
  // Titre dont le menu de statuts (appui long) est ouvert.
  const [statusMenu, setStatusMenu] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showPartage, setShowPartage] = useState(false);
  const [showAmis, setShowAmis] = useState(false);
  // Profil partagé (amis par code) du profil actif, ou null s'il n'est pas activé.
  const [partage, setPartage] = useState(null);
  const rafraichirPartage = () => getPartage().then(setPartage).catch(() => setPartage(null));
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
  // Thème : Automatique / Clair / Sombre (posé sur <html> par main.jsx au démarrage).
  const [choixTheme, setChoixTheme] = useState(lireChoix);

  function changerTheme(choix) {
    setChoixTheme(choix);
    appliquerTheme(choix);
  }

  const [listes, setListes] = useState([]);
  // Tri et filtres de « Mes listes » : gardés par l'application le temps de la
  // séance (on les retrouve en changeant de statut, de liste ou d'onglet),
  // jamais enregistrés d'une session à l'autre.
  const [filtresListes, setFiltresListes] = useState(FILTRES_BIBLIO_VIDES);
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

  // Cycle de vérification des notifications de sortie (figé le 2026-09-27) :
  // ne revérifie que les titres suivis « en attente » d'une date, au plus une
  // fois par jour — sinon rester l'application ouverte redemanderait les mêmes
  // fiches à TMDB sans arrêt. La date du dernier passage est gardée par
  // profil, hors base : ce n'est pas une donnée de suivi, juste un repère
  // local à l'appareil.
  // Une fois le cycle passé (ou déjà fait aujourd'hui), on regarde — à chaque
  // lancement, sans condition de date : une lecture locale, sans appel réseau,
  // rien ne justifie de l'espacer — si des titres sont désormais dus, et on
  // les notifie. C'est ce dernier pas qui envoie la vraie notification.
  useEffect(() => {
    if (!activeProfile) return;
    const cle = `notif-cycle:${activeProfile}`;
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const cycle =
      localStorage.getItem(cle) === aujourdhui
        ? Promise.resolve()
        : verifierNotifications()
            .then(() => localStorage.setItem(cle, aujourdhui))
            .catch(() => {});
    cycle.then(() => notifierSortiesDues()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile]);

  // Genres chargés une fois (indépendants du profil).
  useEffect(() => {
    getGenres().then(setGenres).catch(() => {});
  }, []);

  // Explorer : la découverte se relance à l'entrée dans le mode, et quand le
  // filtre Films/Séries ou l'un des filtres change. Le genre est facultatif.
  useEffect(() => {
    if (searchMode !== 'genre') return;
    runDiscover(selectedGenre, mediaFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaFilter, searchMode, filtres]);

  // Liste des plateformes : chargée en entrant dans Explorer (et rechargée si la
  // langue, donc la région, change).
  useEffect(() => {
    if (searchMode !== 'genre') return;
    getPlateformes().then(setPlateformes).catch(() => {});
  }, [searchMode, catalogLang]);

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
    if (!query && acteurParFiche.current) return;
    acteurParFiche.current = false;
    const seq = ++searchSeq.current;
    setFicheOrigine(null);
    if (!query) {
      setResults([]);
      setPerson(null);
      setStatus('idle');
      setHasSearched(false);
      return;
    }
    derniereRecherche.current = query;
    setStatus('loading');
    setError('');
    setErreurReseau(false);
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
        setErreurReseau(estErreurReseau(err));
        setStatus('error');
      }
    }
  }

  // Touche un acteur dans une fiche : on ferme la fiche et on affiche sa
  // filmographie dans l'onglet Recherche, en mode acteur.
  async function handleOpenActor(actor) {
    const seq = ++searchSeq.current;
    acteurParFiche.current = true;
    setBarreCle((n) => n + 1);
    setFicheOrigine({ item: openDetail, view });
    setOpenDetail(null);
    showTab('search');
    setFiltres(FILTRES_VIDES);
    setFiltresOuverts(false);
    setSearchMode('actor');
    setSelectedGenre(null);
    setMediaFilter('all');
    setResults([]);
    setPerson(null);
    setError('');
    setHasSearched(true);
    setStatus('loading');
    try {
      const { person: found, results: credits } = await getActorFilmography(actor.id);
      if (seq === searchSeq.current) {
        setPerson(found);
        setResults(credits);
        setStatus('done');
      }
    } catch (err) {
      if (seq === searchSeq.current) {
        setError(err.message);
        setStatus('error');
      }
    }
  }

  // Rouvre la fiche d'où l'on venait, dans l'onglet où elle était.
  function retourFiche() {
    const origine = ficheOrigine;
    acteurParFiche.current = false;
    setFicheOrigine(null);
    if (!origine) return;
    showTab(origine.view);
    setOpenDetail(origine.item);
  }

  // Change de mode de recherche en repartant d'un état propre.
  function changeMode(mode) {
    // Retoucher Explorer ne doit pas vider la découverte affichée.
    if (mode === 'genre' && searchMode === 'genre') return;
    acteurParFiche.current = false;
    setFicheOrigine(null);
    // Les filtres d'un mode ne suivent pas dans l'autre : leur effet n'est pas le même.
    setFiltres(FILTRES_VIDES);
    setFiltresOuverts(false);
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
    const params = {
      genre: genre?.key, // facultatif : sans genre, tout le catalogue
      movie: filter !== 'tv',
      tv: filter !== 'movie',
      page,
      filtres,
    };
    if (!append) setStatus('loading');
    try {
      // Les titres déjà suivis sont masqués à l'affichage : une page TMDB de
      // 40 titres peut n'en laisser que 3. On enchaîne donc les pages jusqu'à
      // avoir de quoi remplir l'écran (12 nouveaux), 4 pages au plus par appui.
      const found = [];
      let p = page;
      let more = true;
      for (let essais = 1; ; essais++) {
        const lot = await discoverGenre({ ...params, page: p });
        if (seq !== searchSeq.current) return;
        if (lot.length === 0) {
          more = false;
          break;
        }
        found.push(...lot);
        const nouveaux = found.filter((r) => !suivi.has(keyOf(r))).length;
        if (nouveaux >= 12 || essais >= 4) break;
        p++;
      }
      setGenrePage(p);
      setGenreMore(more);
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

  // Retoucher le genre déjà choisi le retire (retour à tout le catalogue).
  function selectGenre(genre) {
    const suivant = selectedGenre?.key === genre.key ? null : genre;
    setSelectedGenre(suivant);
    setGenrePage(1);
    setGenreMore(true);
    runDiscover(suivant, mediaFilter, 1, false);
  }

  // Titres ajoutés pendant cette séance. La découverte (genre, acteur,
  // tendances) masque ce qu'on a déjà — mais un titre qu'on vient d'ajouter
  // ne doit pas disparaître sous le doigt : il reste affiché, avec sa pastille
  // dorée, jusqu'au prochain lancement.
  const [ajoutsSeance, setAjoutsSeance] = useState(() => new Set());
  const garderAffiche = (key) => setAjoutsSeance((prev) => new Set(prev).add(key));
  const dejaChezMoi = (item) =>
    suivi.has(keyOf(item)) && !ajoutsSeance.has(keyOf(item));

  async function handleToggleFollow(item) {
    const key = keyOf(item);
    try {
      if (suivi.has(key)) {
        await removeFromSuivi(item.mediaType, item.id);
      } else {
        await addToSuivi(item);
        garderAffiche(key);
      }
      loadSuivi();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSetStatus(item, newStatus) {
    try {
      await apiSetStatus(item.mediaType, item.id, newStatus);
      vibre();
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
      if (!suivi.has(keyOf(item))) {
        await addToSuivi(item);
        garderAffiche(keyOf(item));
      }
      await apiSetStatus(item.mediaType, item.id, newStatus);
      vibre();
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
    getGenres().then(setGenres).catch(() => {});
    return res;
  }

  async function handleCreateListe(name) {
    try {
      const created = await apiCreateListe(name);
      // Une liste créée est visible par les amis : on propose tout de suite de la
      // garder pour soi, plutôt que de la découvrir publique plus tard.
      if (partage?.actif && window.confirm(
        `La liste « ${name} » sera visible par tes amis. La passer en privée ?`
      )) {
        await apiSetListePrive(created.id, true);
      }
      loadListes();
      return created;
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSetListePrive(id, prive) {
    try {
      await apiSetListePrive(id, prive);
      loadListes();
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
    else if (showAmis && openDetail) closeDetail(); // la fiche d'un titre ouverte depuis un ami
    else if (showPartage) setShowPartage(false);
    else if (showProfiles) setShowProfiles(false);
    else if (surcouche) surcouche.fermer();
    else if (showAmis) setShowAmis(false);
    else if (showBackup) setShowBackup(false);
    else if (showNotifications) setShowNotifications(false);
    else if (showAbout) setShowAbout(false);
    else if (openDetail) closeDetail();
    else if (ficheOrigine) retourFiche();
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
    // La fiche partagée suit le même rythme que la sauvegarde : en quittant, en
    // revenant. Discret, et sans effet si le partage n'est pas activé.
    publierPartageAuto();
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
    rafraichirPartage();
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

  const resultsDuType =
    mediaFilter === 'all'
      ? results
      : results.filter((r) => r.mediaType === mediaFilter);

  // Titre et Acteur : les filtres (année, tri) jouent sur ce qui est déjà
  // affiché — TMDB ne filtre pas ces listes. Explorer, lui, les envoie
  // directement à TMDB (voir tmdb.js) : `results` en tient déjà compte.
  const resultsAffiches =
    searchMode !== 'genre' ? appliquerFiltres(resultsDuType, filtres) : resultsDuType;

  // Par genre et par acteur, on cherche à découvrir : ce qu'on a déjà est
  // masqué. Par titre, on le garde — on y cherche souvent un titre précis
  // pour l'ouvrir.
  const decouverte = searchMode === 'genre' || searchMode === 'actor';
  const filteredResults = decouverte
    ? resultsAffiches.filter((r) => !dejaChezMoi(r))
    : resultsAffiches;
  const masques = resultsAffiches.length - filteredResults.length;
  // Un filtre (Titre / Acteur) qui vide une liste pourtant non vide : message
  // différent de « Aucun résultat » (qui, lui, dit que la recherche n'a rien donné).
  const filtresToutEcarte =
    searchMode !== 'genre' &&
    filtresActifs(filtres) &&
    resultsDuType.length > 0 &&
    resultsAffiches.length === 0;

  // Écran de recherche à vide (titre / acteur, avant toute frappe) : on propose
  // l'accueil (Tendances / Nouveautés / À venir) plutôt qu'un écran vide.
  const isDefault = searchMode !== 'genre' && !hasSearched;
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
      <>
        <CatalogLanguage
          current={null}
          onApply={applyInitialLanguage}
          welcome
          onRestore={() => setShowBackup(true)}
        />
        {showBackup && activeProfile && (
          <Backup
            profileId={activeProfile}
            profileName={profiles.find((p) => p.id === activeProfile)?.name || 'Mon profil'}
            onRestored={handleRestored}
            onClose={() => setShowBackup(false)}
          />
        )}
      </>
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
        <div className="rappel panel panel--accent">
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
      <div key={view} className="view-enter">

      {view === 'search' && (
        <>
          {/* Le champ de recherche d'abord : c'est ce pour quoi on ouvre l'écran.
              Les modes et les filtres viennent ensuite, pas l'inverse. */}
          {searchMode !== 'genre' && (
            <SearchBar
              key={barreCle}
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
              ['genre', 'Explorer'],
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
            <div className="chips-scroll chips-scroll--page">
              {genres.map((g) => (
                <button
                  key={g.key}
                  className={`chip ${selectedGenre?.key === g.key ? 'on' : ''}`}
                  onClick={() => selectGenre(g)}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}

          {(hasSearched || isDefault) && (
            <div className="seg seg--sm">
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

          {/* Filtres : dans Explorer dès l'entrée ; dans Titre et Acteur, une fois
              qu'il y a des résultats à filtrer. */}
          {(searchMode === 'genre' ||
            (hasSearched && searchMode !== 'genre' && resultsDuType.length > 0)) && (
            <>
              <div className="filtres-bar">
                <button
                  className={`chip ${filtresOuverts || filtresActifs(filtres) ? 'on' : ''}`}
                  aria-expanded={filtresOuverts}
                  onClick={() => setFiltresOuverts((o) => !o)}
                >
                  Filtres
                  {filtresActifs(filtres) && <span className="filtres-bar__dot" aria-hidden="true" />}
                </button>
              </div>
              {filtresOuverts && (
                <Filtres
                  filtres={filtres}
                  onChange={setFiltres}
                  plateformes={plateformes}
                  avecPlateformes={searchMode === 'genre'}
                  indicationPlateforme={searchMode !== 'genre'}
                />
              )}
            </>
          )}

          {searchMode === 'actor' && person && (
            <div className="actor-head">
              {person.photoUrl && <img src={person.photoUrl} alt={person.name} />}
              <span>
                Films &amp; séries avec <b>{person.name}</b>
              </span>
              {ficheOrigine && (
                <button className="btn btn--ghost" onClick={retourFiche}>
                  Retour à la fiche
                </button>
              )}
            </div>
          )}

          {searchMode === 'genre' && selectedGenre && (
            <div className="actor-head">
              <span>
                Genre : <b>{selectedGenre.name}</b>
              </span>
            </div>
          )}

          {status === 'loading' && <GrilleFantome />}
          {status === 'error' &&
            (erreurReseau ? (
              <HorsLigne onRetry={() => handleSearch(derniereRecherche.current)} />
            ) : (
              <Vide icone="info" titre="La recherche a échoué" texte={error} />
            ))}
          {status === 'done' &&
            hasSearched &&
            searchMode === 'actor' &&
            !person && <p className="hint">Aucun acteur trouvé.</p>}
          {status === 'done' &&
            hasSearched &&
            filteredResults.length === 0 &&
            !(searchMode === 'actor' && !person) && (
              <Vide
                icone="search"
                titre={masques > 0 && !filtresToutEcarte ? 'Tu as déjà tout' : 'Aucun résultat'}
                texte={
                  filtresToutEcarte
                    ? 'Aucun titre ne correspond à ces filtres.'
                    : masques > 0
                      ? 'Tu as déjà tous ces titres dans ton suivi.'
                      : 'Essaie une autre orthographe, ou cherche par acteur.'
                }
              />
            )}
          {status === 'done' && decouverte && masques > 0 && filteredResults.length > 0 && (
            <p className="hint hint--small">
              {masques === 1
                ? '1 titre que tu as déjà est masqué.'
                : `${masques} titres que tu as déjà sont masqués.`}
            </p>
          )}

          {status === 'done' && hasSearched && filteredResults.length > 0 && (
            <header className="sec__head">
              <div className="sec__txt">
                <h3 className="sec__title">
                  Résultats <span className="sec__count">{filteredResults.length}</span>
                </h3>
              </div>
            </header>
          )}

          {isDefault && (
            <>
              <header className="sec__head">
                <div className="sec__txt">
                  <h3 className="sec__title">Tendances</h3>
                  <p className="sec__sub">Ce que tout le monde regarde en ce moment</p>
                </div>
              </header>
              <Rubriques
                rubriques={[['tendances', 'Tendances']]}
                mediaFilter={mediaFilter}
                suivi={suivi}
                dejaChezMoi={dejaChezMoi}
                cardProps={cardProps}
                resetKey={catalogLang}
              />
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
          onSetPrive={handleSetListePrive}
          partageActif={!!partage?.actif}
          onAddManyToListe={handleAddManyToListe}
          onSurcouche={setSurcouche}
          filtres={filtresListes}
          onFiltres={setFiltresListes}
          genres={genres}
          onOpenStats={() => setShowStats(true)}
          onSearch={() => goTo('search')}
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
          suivi={suivi}
          dejaChezMoi={dejaChezMoi}
          catalogLang={catalogLang}
          subTab={tonightTab}
          onSubTab={setTonightTab}
          onSearch={() => goTo('search')}
          profileId={activeProfile}
        />
      )}

      {view === 'settings' && (
        <Settings
          profiles={profiles}
          activeProfile={activeProfile}
          onOpenProfiles={() => setShowProfiles(true)}
          onOpenStats={() => setShowStats(true)}
          onOpenPartage={() => setShowPartage(true)}
          onOpenAmis={() => setShowAmis(true)}
          partageDisponible={partageDisponible()}
          partageActif={!!partage?.actif}
          onSelectProfile={handleSelectProfile}
          choixTheme={choixTheme}
          onChoixTheme={changerTheme}
          catalogLang={catalogLang}
          catalogLangLabel={languageLabel(catalogLang)}
          onOpenLanguage={() => setShowLanguage(true)}
          onOpenBackup={() => setShowBackup(true)}
          onOpenNotifications={() => setShowNotifications(true)}
          onOpenAbout={() => setShowAbout(true)}
          suiviCount={suivi.size}
        />
      )}

      {view === 'discover' && (
        <Decouvrir
          items={Array.from(suivi.values())}
          suivi={suivi}
          dejaChezMoi={dejaChezMoi}
          cardProps={cardProps}
          resetKey={catalogLang}
        />
      )}
      </div>
      </main>

      <nav className="tabbar">
        {[
          ['search', 'Recherche', 'search'],
          ['tonight', 'Ce soir', 'film'],
          ['lists', 'Mes listes', 'lists'],
          ['discover', 'Découvrir', 'compass'],
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

      {/* Avant la fiche d'un titre : celle-ci s'ouvre par-dessus quand on touche une affiche. */}
      {showAmis && activeProfile && (
        <Amis
          cardProps={cardProps}
          suivi={suivi}
          onSurcouche={setSurcouche}
          onClose={() => setShowAmis(false)}
        />
      )}

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
          onOpenActor={handleOpenActor}
        />
      )}

      {showStats && <Stats genres={genres} onClose={() => setShowStats(false)} />}

      {showPartage && activeProfile && (
        <Partage
          profileName={profiles.find((p) => p.id === activeProfile)?.name || ''}
          onChanged={() => {
            rafraichirPartage();
            loadListes();
          }}
          onClose={() => setShowPartage(false)}
        />
      )}

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

      {showNotifications && (
        <Notifications onClose={() => setShowNotifications(false)} />
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
