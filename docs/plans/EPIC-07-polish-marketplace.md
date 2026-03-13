# EPIC 7 — Polish, Settings & Marketplace

**Priorità**: P2
**Sprint**: 9
**Stima**: 3-4 giorni
**Dipendenze**: Epic 5 completata (Epic 6 consigliata)

---

## Contesto

Il plugin funziona. Ora lo rendiamo pronto per il mondo: settings configurabili, onboarding per nuovi utenti, keyboard shortcuts, accessibilità, e pubblicazione sul VS Code Marketplace.

---

## Story 7.1 — Settings configurabili

**Come** sviluppatore, **voglio** personalizzare il comportamento del plugin, **per** adattarlo al mio workflow.

### Tasks

1. Registrare le settings in `package.json` (contributes.configuration):

   | Setting | Tipo | Default | Descrizione |
   |---------|------|---------|-------------|
   | `planReviewer.promptLanguage` | enum | `"english"` | Lingua del prompt generato (english, italian) |
   | `planReviewer.promptMode` | enum | `"same_session"` | Modalità default: same_session o new_session |
   | `planReviewer.promptTemplate` | string | (template default) | Template personalizzabile del prompt |
   | `planReviewer.staleThresholdHours` | number | `4` | Ore dopo cui suggerire "new session" mode |
   | `planReviewer.defaultViewColumn` | enum | `"beside"` | Dove aprire la WebView: beside, active, one, two, three |
   | `planReviewer.autoCarryComments` | boolean | `true` | Portare avanti commenti non risolti automaticamente |
   | `planReviewer.showTimeline` | boolean | `true` | Mostrare la timeline sotto la toolbar |
   | `planReviewer.dbLocation` | enum | `"global"` | Posizione DB: global o workspace |

2. Creare `src/extension/services/ConfigService.ts` che wrappa `vscode.workspace.getConfiguration('planReviewer')` con tipizzazione forte
3. Reagire ai cambiamenti di configurazione (`onDidChangeConfiguration`)

### Criteri di accettazione

- [ ] Le settings appaiono in VS Code Settings UI sotto "Plan Reviewer"
- [ ] Ogni setting ha descrizione e default sensato
- [ ] I cambiamenti vengono applicati senza riavviare l'estensione
- [ ] Il `ConfigService` è type-safe

---

## Story 7.2 — Keyboard Shortcuts

**Come** sviluppatore, **voglio** usare shortcuts, **per** velocizzare il workflow.

### Tasks

1. Registrare i keybindings in `package.json` (contributes.keybindings):

   | Shortcut | Comando | Contesto |
   |----------|---------|----------|
   | `Ctrl+Shift+R` | `planReviewer.newReview` | Sempre |
   | `Ctrl+Shift+G` | `planReviewer.generatePrompt` | WebView attiva |
   | `Ctrl+Shift+D` | `planReviewer.toggleDiff` | WebView attiva |

2. Nella WebView, gestire shortcuts locali via `keydown` listener:

   | Shortcut | Azione | Contesto |
   |----------|--------|----------|
   | `Ctrl+Enter` | Submit commento | Form commento aperto |
   | `Esc` | Chiudi form / Chiudi pannello commenti | Form o pannello aperto |
   | `N` | Vai al prossimo commento | Nessun form aperto |
   | `P` | Vai al commento precedente | Nessun form aperto |

3. Mostrare i shortcuts nella tooltip dei bottoni

### Criteri di accettazione

- [ ] I keybindings globali funzionano dal Command Palette
- [ ] I keybindings locali funzionano nella WebView
- [ ] Nessun conflitto con shortcuts di VS Code o altre estensioni comuni
- [ ] I tooltips dei bottoni mostrano lo shortcut

---

## Story 7.3 — Onboarding Walkthrough

**Come** nuovo utente, **voglio** una guida al primo avvio, **per** capire come usare il plugin.

### Tasks

1. Registrare un Walkthrough in `package.json` (contributes.walkthroughs):
   - **Step 1**: "Copy a plan from Copilot Chat" — descrizione + GIF/immagine
   - **Step 2**: "Start a review" — mostra il comando e come invocarlo
   - **Step 3**: "Add comments" — spiega il flusso dei commenti inline
   - **Step 4**: "Generate review prompt" — spiega il bottone e le modalità
   - **Step 5**: "Capture the new version" — chiude il loop
2. Al primo avvio (flag in `globalState`), mostrare una notification:
   - "Welcome to Plan Reviewer! [Get Started] [Dismiss]"
   - "Get Started" apre il walkthrough
3. Creare un piano di esempio pre-caricato:
   - File `resources/sample-plan.md` con un piano realistico
   - Il walkthrough include un bottone "Load Sample Plan" che lo carica nel plugin

### Criteri di accettazione

- [ ] Il walkthrough appare nelle Getting Started di VS Code
- [ ] Al primo avvio, notifica di benvenuto
- [ ] Il piano di esempio si carica correttamente
- [ ] Ogni step del walkthrough è chiaro e autoesplicativo

---

## Story 7.4 — Accessibilità

**Come** sviluppatore con esigenze di accessibilità, **voglio** che la WebView sia navigabile da tastiera e leggibile da screen reader, **per** poter usare il plugin.

### Tasks

1. Audit della WebView per accessibilità:
   - Tutti gli elementi interattivi hanno `role` ARIA appropriati
   - I commenti sono `role="article"` con `aria-label` che include categoria e riga
   - I bottoni hanno `aria-label` descrittivi
   - Il form commento ha `aria-describedby` per il contesto
2. Navigazione da tastiera completa:
   - Tab order logico: toolbar → piano (riga per riga) → commenti → pannello laterale
   - `Enter` su una riga con "+" apre il form
   - Focus visibile (outline) su tutti gli elementi interattivi
3. Supporto alto contrasto:
   - Usare CSS variables di VS Code per i colori
   - Verificare che i colori delle categorie siano distinguibili in high contrast mode
   - Aggiungere pattern (tratteggio, puntini) oltre al colore per differenziare le categorie

### Criteri di accettazione

- [ ] Navigazione completa da tastiera senza mouse
- [ ] Screen reader annuncia correttamente commenti, bottoni, status
- [ ] Alto contrasto: tutti gli elementi sono visibili e distinguibili
- [ ] Nessun colore usato come unico differenziatore (sempre colore + forma/icona)

---

## Story 7.5 — Packaging e Marketplace

**Come** sviluppatore, **voglio** pubblicare il plugin sul VS Code Marketplace, **per** renderlo disponibile alla community.

### Tasks

1. Preparare i metadata in `package.json`:
   - `displayName`, `description`, `categories`, `keywords`
   - `icon` — creare un'icona 256x256 PNG (tema: review/annotazione + AI)
   - `repository`, `license` (MIT), `publisher`
   - `engines.vscode` — versione minima supportata
2. Scrivere `README.md` per il Marketplace:
   - Hero image/GIF del workflow completo
   - Feature list con screenshot
   - Quick start in 3 step
   - Settings reference
   - Keyboard shortcuts reference
   - FAQ
3. Creare `CHANGELOG.md` con le release notes per v1.0.0
4. Setup GitHub Actions CI/CD:
   - Build + test on push/PR
   - `vsce package` per creare il .vsix
   - `vsce publish` su tag (manuale o auto)
5. Creare un `.vscodeignore` per escludere file non necessari dal package

### Criteri di accettazione

- [ ] `vsce package` produce un .vsix funzionante
- [ ] Il .vsix si installa e funziona in VS Code stable
- [ ] README ha screenshot/GIF e documentazione
- [ ] GitHub Actions compila e testa ad ogni push
- [ ] L'icona è presente e visibile
- [ ] La dimensione del .vsix è ragionevole (< 5MB)

---

## Definition of Done — Epic 7

Il plugin è:
1. Configurabile via Settings UI
2. Usabile con shortcuts
3. Accessibile (keyboard + screen reader + alto contrasto)
4. Documentato con walkthrough e README
5. Pubblicato sul VS Code Marketplace

**Il plugin è pronto per il mondo.**

---

## Note per Claude Code

- Per l'icona, crea un SVG semplice e convertilo in PNG. Non serve qualcosa di elaborato — un'icona minimalista con un documento + simbolo di commento funziona bene
- Il walkthrough di VS Code richiede immagini/media nella cartella `resources/` — tienile leggere (< 500KB ciascuna)
- Per il CI, il template base di GitHub Actions per VS Code extension è: `actions/setup-node` + `npm install` + `npm run build` + `npm test`
- `vsce` richiede un Personal Access Token di Azure DevOps per pubblicare. Istruisci l'utente nel README
- Testa il .vsix su VS Code Insiders oltre che Stable per anticipare problemi
