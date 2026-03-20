# Plan Reviewer

🇬🇧 [English](README.md) | 🇮🇹 [Italiano](README.it.md)

> **⚠️ Software in fase Alpha** — Questo progetto è in alpha iniziale. API, formati dati e funzionalità possono cambiare senza preavviso. Usalo a tuo rischio e aspettati modifiche incompatibili tra le versioni.

Revisiona i piani generati dall'AI con commenti inline, direttamente dentro VS Code. Come una code review su GitHub, ma per piani in markdown.

![Panoramica di Plan Reviewer](docs/screenshots/overview.png)

## Funzionalità

### Commenti inline

Clicca il pulsante `+` su una riga qualsiasi per aprire il form di commento. Puoi commentare una singola riga o un intervallo, scegliendo tra le categorie: issue, suggestion, question o approval.

![Form di commento inline](docs/screenshots/inline-form.png)

### Schede commento

I commenti appaiono come schede accanto alla riga a cui si riferiscono. Da lì puoi modificarli, risolverli o eliminarli.

![Scheda commento](docs/screenshots/comment-card.png)

### Commenti su selezione di testo

Seleziona del testo nel piano e compare un pulsante flottante per commentare quella porzione specifica.

![Selezione testo](docs/screenshots/text-selection.png)

### Navigatore commenti

Apre un pannello laterale che raggruppa i commenti per sezione. Cliccando su uno di essi salti direttamente alla riga corrispondente.

![Navigatore commenti](docs/screenshots/navigator-open.png)

### Ricerca

Premi `Ctrl+F` per cercare nel piano. Le corrispondenze vengono evidenziate e puoi scorrerle una per una.

![Ricerca](docs/screenshots/search-active.png)

### Generazione prompt

Raccogli i commenti della review in un prompt da reinviare all'AI che ha scritto il piano. "Changes only" invia solo le sezioni commentate; "Full context" include il piano completo.

![Modale generazione prompt](docs/screenshots/prompt-modal.png)

### Barra strumenti

Mostra lo stato della review, il selettore versione e il conteggio commenti. Qui trovi anche i pulsanti per ricerca, navigatore e generazione prompt.

![Barra strumenti](docs/screenshots/toolbar.png)

## Guida rapida

1. Installa dal VS Code Marketplace (oppure `code --install-extension plan-reviewer-0.0.1.vsix`)
2. Apri il pannello **Plan Reviewer** dalla Activity Bar
3. Copia un piano markdown negli appunti, poi lancia **Plan Reviewer: New Review**
4. Aggiungi commenti sulle righe che vuoi modificare
5. Clicca **Generate Prompt**, copia il risultato e incollalo nella conversazione con l'AI

## Utilizzo

### Creare una review

Copia il piano generato dall'AI (in markdown) negli appunti e lancia il comando **Plan Reviewer: New Review**. L'estensione lo suddivide in sezioni e salva tutto localmente in SQLite.

### Commentare

Puoi aggiungere commenti in vari modi:

- **Commento su riga**: clicca `+` su una riga qualsiasi
- **Commento su intervallo**: clicca `+`, poi seleziona una riga finale per coprire più righe
- **Commento su sezione**: punta a un intero titolo di sezione
- **Selezione testo**: evidenzia del testo nel piano e clicca il pulsante flottante

Le categorie disponibili sono issue, suggestion, question e approval.

### Versioning

Incolla una versione aggiornata del piano e l'estensione la salva come nuova versione. I commenti non risolti vengono rimappati sulle righe giuste nella nuova versione tramite allineamento basato su diff, così non perdi il lavoro di review fatto fino a quel momento.

### Generazione prompt

Premi `Ctrl+Shift+G` (o clicca il pulsante nella barra strumenti) per aprire la modale prompt. Scegli una modalità:

- **Changes only**: include solo le sezioni con commenti
- **Full context**: invia il piano completo con tutti i commenti annotati inline

Copia il risultato e incollalo nella conversazione con l'AI.

### Import / Export

Usa **Plan Reviewer: Export Plan** per salvare un piano come file JSON, utile per backup o condivisione. **Import Plan** lo ricarica, incluse tutte le versioni e i commenti.

### Scorciatoie da tastiera

| Scorciatoia | Azione |
|-------------|--------|
| `Ctrl+F` | Cerca nel piano |
| `Ctrl+Shift+G` | Genera prompt |

## Architettura

<details>
<summary>Modello a due processi</summary>

L'estensione gira su due processi:

- **Extension host** (Node.js) — gestisce comandi, persistenza dati e parsing del piano
- **Webview** (React) — renderizza l'interfaccia in un iframe sandboxed

Comunicano tramite messaggi tipizzati (`HostMessage` / `WebViewMessage`, union discriminate definite in `src/shared/messages.ts`).

**Flusso dati:**

1. L'utente copia il markdown negli appunti e lancia "New Review"
2. L'estensione analizza le sezioni con `MarkdownParser`, crea un Plan + Version in SQLite e apre la webview
3. La webview riceve un messaggio `planLoaded` e renderizza il piano con `react-markdown`
4. L'utente aggiunge commenti su righe, intervalli o sezioni
5. Con una nuova versione, `CommentMapper` usa `DiffEngine` per rimappare i commenti non risolti sul piano aggiornato

**Storage:** SQLite via sql.js (WASM), salvato nel global storage di VS Code. Lo schema è gestito tramite migrazioni numerate.

</details>

## Sviluppo

### Prerequisiti

- Node.js 20+
- VS Code 1.85+

### Setup

```bash
npm install
npm run dev    # watch mode con esbuild
```

Premi **F5** in VS Code per lanciare l'Extension Development Host e fare debug.

### Comandi

| Comando | Descrizione |
|---------|-------------|
| `npm run build` | Build di produzione |
| `npm run dev` | Watch mode (ricompila ad ogni modifica) |
| `npm run compile` | Solo type-check (`tsc --noEmit`) |
| `npm run test` | Test unitari (Vitest) |
| `npm run test:e2e` | Test E2E (Playwright) |
| `npm run capture` | Build + cattura screenshot |
| `npm run lint` | ESLint |
| `npm run package` | Build + creazione `.vsix` |

Per lanciare un singolo test: `npx vitest run src/test/SomeTest.test.ts`

## Stack tecnologico

TypeScript, React 19, esbuild, sql.js (WASM), react-markdown, highlight.js, Playwright, Vitest

## Contribuire

Consulta [CONTRIBUTING.it.md](CONTRIBUTING.it.md) per le linee guida. Tutti i contributi devono passare attraverso una Pull Request.

## Licenza

MIT
