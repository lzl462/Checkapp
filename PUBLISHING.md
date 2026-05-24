# Checkapp Veröffentlichung

Die App soll künftig über GitHub Pages aus dem Repository `Checkapp` veröffentlicht werden.

Der frühere lokale Webserver wurde entfernt:

- kein `LaunchAgent` für Checkapp
- keine öffentliche Kopie unter `/Users/lizgerhardt/Public/Checkapp`
- keine Symlinks von Projektdateien auf eine lokale Server-Kopie

Die maßgeblichen App-Dateien liegen jetzt direkt im Repository:

- `index.html`
- `styles.css`
- `script.js`

## Nächster Veröffentlichungsschritt

Der GitHub-Pages-Workflow liegt unter `.github/workflows/pages.yml` und veröffentlicht die statische App aus dem Branch `main`.

Nach dem ersten erfolgreichen Deployment sollte die App unter folgender Adresse erreichbar sein:

`https://lzl462.github.io/Checkapp/`
