// Lance les tests des règles Firestore contre l'émulateur local.
// - Projet « demo-… » : l'émulateur ne parle jamais au vrai projet Firebase.
// - Ports à part (voir firebase.json) pour ne pas gêner un autre émulateur déjà lancé.
// - L'émulateur exige Java 17+ : à défaut, on prend celui d'Android Studio.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const env = { ...process.env };
const jbr = 'C:/Program Files/Android/Android Studio/jbr';
if (existsSync(`${jbr}/bin/java.exe`)) {
  env.JAVA_HOME = jbr;
  env.PATH = `${jbr}/bin;${env.PATH}`;
}

const r = spawnSync(
  'npx',
  [
    'firebase', 'emulators:exec', '--only', 'firestore', '--project', 'demo-vault-watch',
    `"npx vitest run -c vitest.regles.config.js ${process.argv[2] || ''}"`,
  ],
  { stdio: 'inherit', env, shell: true }
);
process.exit(r.status ?? 1);
