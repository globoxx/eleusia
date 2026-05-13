# Eleus-IA

Application React + Vite avec serveur Node/Express et Socket.IO.

## Scripts

- `npm run start:client`: lance le client Vite en développement.
- `npm run start:server`: lance le serveur TypeScript avec `ts-node`.
- `npm run build`: compile le client dans `dist/client` puis le serveur dans `dist/server`.
- `npm start`: lance le serveur compilé avec `node dist/server/server.js`.
- `npm test`: lance les tests Vitest.
- `npm run typecheck`: vérifie les types client et serveur.

## Build De Production

```bash
npm run build
npm start
```

Le serveur sert le client depuis `dist/client` par défaut. La variable d'environnement `BUILD_PATH` permet de fournir un autre dossier de build si nécessaire.
