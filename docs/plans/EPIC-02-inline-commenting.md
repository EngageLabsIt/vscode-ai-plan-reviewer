# EPIC 2 — Inline Commenting System

**Priorità**: P0
**Sprint**: 3
**Stima**: 4-5 giorni
**Dipendenze**: Epic 1 completata

---

## Contesto

Il piano si vede. Ora serve poterci scrivere sopra. Questa è l'epic centrale del plugin: il sistema di commenti inline stile GitHub PR review. L'utente deve poter aggiungere, modificare, cancellare e categorizzare commenti su righe singole e range di righe.

---

## Story 2.1 — Commenti su singola riga

**Come** sviluppatore, **voglio** aggiungere un commento su una specifica riga del piano, **per** dare feedback puntuale su un singolo punto.

### Tasks

1. Nel `PlanViewer`, al hover su una riga, mostrare un'icona "+" nel gutter (a sinistra del numero di riga)
2. Click sul "+" → appare un form inline subito sotto la riga:
   - `textarea` per il corpo del commento (auto-resize, min 2 righe)
   - `select` per la categoria: Suggestion (blu), Issue (rosso), Question (giallo), Approval (verde)
   - Bottoni: "Add Comment" (primario), "Cancel" (secondario)
   - `Ctrl+Enter` = submit, `Esc` = cancel
3. Al submit:
   - WebView invia `addComment` message all'host
   - Host salva nel DB via `CommentRepository`
   - Host risponde con `commentAdded` message
   - WebView mostra il commento salvato sotto la riga
4. Creare `src/webview/components/CommentForm.tsx` (il form inline)
5. Creare `src/webview/components/CommentCard.tsx` (il commento renderizzato)

### UI del CommentCard

```
┌─ 💡 Suggestion ──────────────────────────────┐
│ Considera di usare un pattern Repository       │
│ invece di accedere al DB direttamente.         │
│                                                │
│                           Edit  Delete  [...]  │
└────────────────────────────────────────────────┘
```

- Bordo sinistro colorato per categoria (blu/rosso/giallo/verde)
- Badge con icona e nome categoria in alto
- Corpo del commento con supporto per testo multiriga
- Azioni: Edit, Delete (visibili al hover o sempre visibili — valutiamo)

### Criteri di accettazione

- [ ] Hover su riga → icona "+" appare nel gutter
- [ ] Click su "+" → form inline appare sotto la riga
- [ ] Il form ha textarea + select categoria + bottoni
- [ ] Ctrl+Enter submits, Esc cancella
- [ ] Il commento viene salvato nel DB e mostrato come card
- [ ] La card ha il colore corretto per la categoria
- [ ] Più commenti sulla stessa riga si impilano verticalmente
- [ ] Il focus torna al piano dopo submit/cancel

---

## Story 2.2 — Commenti su range di righe

**Come** sviluppatore, **voglio** selezionare un range di righe e commentarlo, **per** dare feedback su un blocco di contenuto.

### Tasks

1. Implementare la selezione di range:
   - Click su riga A + Shift+Click su riga B → seleziona il range A-B
   - Oppure: click-and-drag nel gutter (numeri di riga) per selezionare un range
   - Le righe selezionate hanno un background highlight (es. leggero blu)
2. Dopo la selezione, mostrare automaticamente il "+" sotto l'ultima riga del range
3. Click sul "+" → form identico a Story 2.1 ma con indicazione "Commenting on lines {A}-{B}"
4. Il commento range viene salvato con `type: 'range'`, `targetStart: A`, `targetEnd: B`
5. Il `CommentCard` per range mostra il badge "Lines {A}-{B}" sotto la categoria
6. Il range selezionato rimane evidenziato quando il commento è visibile

### Criteri di accettazione

- [ ] Shift+Click seleziona un range di righe
- [ ] Il range è visualmente evidenziato
- [ ] Il form mostra "Lines X-Y"
- [ ] Il commento viene salvato con type "range"
- [ ] Il card mostra il range di righe
- [ ] Deselezionare (click altrove) rimuove l'highlight di selezione (ma i commenti restano)

---

## Story 2.3 — Edit e Delete commenti

**Come** sviluppatore, **voglio** modificare o cancellare un commento, **per** correggere errori o rimuovere feedback non più rilevanti.

### Tasks

1. Nel `CommentCard`, aggiungere azioni:
   - **Edit** → il card diventa un form pre-compilato (stessa UI di `CommentForm` ma con valori esistenti)
   - **Delete** → dialog di conferma ("Delete this comment?") → rimuove dal DB e dalla UI
   - **Change category** → dropdown rapido per cambiare la categoria senza aprire il form completo
2. Il flusso di edit:
   - Click "Edit" → il card si trasforma in form
   - L'utente modifica → "Save" / "Cancel"
   - WebView invia `updateComment`, host aggiorna DB, host risponde con `commentUpdated`
3. Il flusso di delete:
   - Click "Delete" → conferma
   - WebView invia `deleteComment`, host rimuove dal DB, host risponde con `commentDeleted`
   - La card scompare con una animazione fade-out

### Criteri di accettazione

- [ ] Click "Edit" → il commento diventa editabile
- [ ] Salvataggio aggiorna il DB e la UI
- [ ] Click "Delete" → conferma → rimozione
- [ ] Cambio categoria funziona senza aprire il form
- [ ] Le operazioni sono riflesse immediatamente nella UI

---

## Story 2.4 — Comment Gutter Indicators

**Come** sviluppatore, **voglio** vedere nel gutter quali righe hanno commenti, **per** avere un colpo d'occhio sullo stato della review.

### Tasks

1. Nel gutter (colonna numeri di riga), mostrare un indicatore per le righe con commenti:
   - Pallino colorato (colore della categoria più grave: issue > question > suggestion > approval)
   - Se ci sono più commenti sulla stessa riga: pallino + numero (es. "🔴 3")
2. Se una riga ha commenti, il "+" al hover cambia in un'icona che indica i commenti esistenti
3. Hover sull'indicatore → tooltip con preview del primo commento

### Criteri di accettazione

- [ ] Righe con commenti mostrano un indicatore colorato nel gutter
- [ ] Il colore riflette la categoria più grave
- [ ] Righe con più commenti mostrano il contatore
- [ ] Tooltip al hover mostra la preview

---

## Definition of Done — Epic 2

L'utente può:
1. Aggiungere commenti su singole righe
2. Aggiungere commenti su range di righe
3. Modificare e cancellare commenti
4. Categorizzare commenti (suggestion/issue/question/approval)
5. Vedere nel gutter quali righe sono commentate

Questo è il cuore dell'interazione. Se questa epic funziona bene, il plugin ha valore.

---

## Note per Claude Code

- La gestione dello stato dei commenti nella WebView è critica. Usa `useReducer` piuttosto che multipli `useState` per gestire la lista commenti, il form attivo, e la selezione corrente
- Il form deve essere un singleton: un solo form aperto alla volta. Se apri un form su riga 5 e poi clicchi "+" su riga 10, il form su riga 5 si chiude
- Per il drag-select nel gutter, attenzione al conflitto con il text selection del browser. Usa `user-select: none` sul gutter e gestisci gli eventi manualmente
- I colori delle categorie devono usare CSS variables che si adattano al tema VS Code. Non hardcodare colori
- Ricorda: la WebView comunica col host tramite `postMessage`. Ogni operazione CRUD è asincrona. Mostra un loading state minimo mentre aspetti la risposta
