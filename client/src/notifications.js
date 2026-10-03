// Couche externe — les notifications locales de l'appareil.
//
// Pendant de `google.js` : une porte unique vers une capacité du système que
// le reste de l'application n'a pas à connaître. Ici, il ne s'agit pas d'un
// compte mais d'une **autorisation système** — celle d'afficher une
// notification dans la barre Android.
//
// Décision de cadrage (2026-09-27, notifications de sortie) :
//  - rien n'est demandé au démarrage : l'autorisation n'est sollicitée que si
//    l'utilisateur ouvre l'écran Notifications et clique sur « Activer » ;
//  - pas d'alarme système programmée à l'avance : chaque notification est
//    envoyée sur le moment, au lancement où l'application constate qu'une
//    date est atteinte (store.takeDueNotifications) — voir la décision 6 du
//    figeage (une sortie manquée arrive en retard, au lancement suivant,
//    plutôt que de dépendre d'une tâche de fond).
import { LocalNotifications } from '@capacitor/local-notifications';

// Identifiant fixe : une seule notification de test à la fois, la renvoyer
// remplace la précédente plutôt que d'en empiler une nouvelle.
const ID_TEST = 1;

// Un identifiant par titre suivi, distinct de ID_TEST et distinct entre un
// film et une série qui partageraient le même identifiant TMDB. Le plugin
// exige un entier 32 bits : les identifiants TMDB (quelques millions au plus)
// tiennent largement dans la marge laissée par ce préfixe.
function idNotification(mediaType, tmdbId) {
  return Number(`${mediaType === 'movie' ? 2 : 3}${tmdbId}`);
}

export async function hasPermission() {
  const { display } = await LocalNotifications.checkPermissions();
  return display === 'granted';
}

export async function requestPermission() {
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted';
}

// Affichée tout de suite. Elle était d'abord programmée 5 secondes plus tard par une alarme
// système, mais Android traite ces alarmes comme « approximatives » et peut les retarder
// ou les laisser dormir écran éteint : le test n'arrivait jamais. Sans alarme, la notification
// est publiée dans la barre immédiatement.
export async function envoyerNotificationTest() {
  await LocalNotifications.schedule({
    notifications: [
      {
        id: ID_TEST,
        title: 'Vault Watch',
        body: 'Les notifications fonctionnent sur cet appareil.',
      },
    ],
  });
}

// Notification réelle pour un titre suivi dont la date est atteinte
// (`store.takeDueNotifications`). Envoyée aussitôt, pour la même raison que le test :
// l'application est ouverte au moment où elle constate la date, aucune alarme n'est utile.
export async function notifierSortie({ id, mediaType, title }) {
  const body =
    mediaType === 'movie' ? `${title} sort aujourd'hui` : `Nouvel épisode de ${title}`;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: idNotification(mediaType, id),
        title: 'Vault Watch',
        body,
      },
    ],
  });
}
