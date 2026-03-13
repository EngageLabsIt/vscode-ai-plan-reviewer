# EPIC 3 — Review Toolbar & Comment Navigation

**Priorità**: P1
**Sprint**: 4
**Stima**: 3 giorni
**Dipendenze**: Epic 2 completata

---

## Contesto

I commenti funzionano. Ora servono gli strumenti per gestire la review: una toolbar con lo stato, un pannello di navigazione commenti, e i commenti per sezione semantica.

---

## Story 3.1 — Toolbar della Review

**Come** sviluppatore, **voglio** una toolbar fissa in cima alla WebView, **per** avere sempre visibile lo stato della review e le azioni principali.

### Tasks

1. Creare `src/webview/components/ReviewToolbar.tsx`:
   - **Sinistra**: titolo del piano (troncato se lungo) + badge status ("In Review" giallo, "Approved" verde, "Archived" grigio)
   - **Centro**: conteggio commenti per categoria: "🔴 2 issues · 💡 3 suggestions · ❓ 1 question · ✅ 1 approval"
   - **Destra**: action buttons:
     - "Request Changes" → cambia status a `needs_revision`, abilita export prompt (Epic 4)
     - "Approve" → cambia status a `approved`
     - "Quick Approve" → approva con una nota opzionale (modal con textarea)
     - Version selector dropdown: "v1" / "v2" / ... (solo v1 per ora, il dropdown è pronto per Epic 5)
2. La toolbar è sticky (resta visibile durante lo scroll)
3. I conteggi si aggiornano in tempo reale quando si aggiungono/rimuovono commenti

### Criteri di accettazione

- [ ] Toolbar fissa in cima alla WebView
- [ ] Titolo + status badge sempre visibili
- [ ] Conteggio commenti per categoria, aggiornato in tempo reale
- [ ] "Approve" e "Quick Approve" cambiano lo status nel DB
- [ ] Version selector presente (anche se con una sola voce per ora)

---

## Story 3.2 — Pannello navigazione commenti

**Come** sviluppatore, **voglio** una lista navigabile di tutti i commenti, **per** saltare rapidamente a un commento specifico.

### Tasks

1. Creare `src/webview/components/CommentNavigator.tsx`:
   - Pannello laterale (sidebar destra) togglabile da un bottone nella toolbar
   - Lista di tutti i commenti raggruppati per categoria (Issues first, poi Questions, Suggestions, Approvals)
   - Ogni item mostra: icona categoria + riga/range + preview del testo (troncata a 50 chars)
   - Click su un item → scroll automatico alla riga corrispondente nel piano + highlight temporaneo
2. Filtri in cima al pannello:
   - Toggle per categoria (mostra/nascondi issues, suggestions, etc.)
   - Toggle "Only unresolved" (preparazione per Epic 5)
3. Contatore totale: "Showing 5 of 8 comments"

### Layout

```
┌─ Comments (5/8) ─────────────┐
│ [🔴 Issues] [💡 Sugg] [❓ Q]  │  ← filtri toggle
├──────────────────────────────┤
│ 🔴 Line 12                   │
│   Il rollback non è gestito  │
│                              │
│ 🔴 Lines 25-30               │
│   JWT refresh mancante       │
│                              │
│ 💡 Line 45                   │
│   Considera CQRS             │
│                              │
│ ❓ Line 8                    │
│   Perché PostgreSQL?         │
└──────────────────────────────┘
```

### Criteri di accettazione

- [ ] Pannello si apre/chiude da un toggle nella toolbar
- [ ] I commenti sono raggruppati per categoria
- [ ] Click su un commento scrolla alla riga e la evidenzia
- [ ] I filtri per categoria funzionano
- [ ] Il contatore si aggiorna con i filtri

---

## Story 3.3 — Commenti su sezione semantica

**Come** sviluppatore, **voglio** commentare un'intera sezione (heading + suo contenuto), **per** dare feedback ad alto livello su uno step del piano.

### Tasks

1. Nel `CommentNavigator`, aggiungere una tab "Sections":
   - Lista delle sezioni estratte (dagli heading)
   - Ogni sezione mostra: titolo heading + numero commenti
   - Click su una sezione → scrolla alla sezione nel piano
2. Ogni sezione nel piano ha un bottone "Comment on section" (icona 💬) visibile al hover sull'heading
3. Click → apre `CommentForm` con `type: 'section'` e `sectionId` precompilato
4. I commenti di sezione appaiono sotto l'heading della sezione con un badge "Section comment"
5. Nella lista del `CommentNavigator`, i commenti sezione sono raggruppati sotto la loro sezione

### Criteri di accettazione

- [ ] Tab "Sections" nel CommentNavigator con lista delle sezioni
- [ ] Hover sull'heading → icona per commentare la sezione
- [ ] Il commento sezione viene salvato con type "section" e section_id
- [ ] I commenti sezione appaiono sotto l'heading
- [ ] La navigazione funziona anche per i commenti sezione

---

## Definition of Done — Epic 3

L'utente può:
1. Vedere lo stato della review nella toolbar
2. Approvare o richiedere cambiamenti
3. Navigare i commenti dal pannello laterale
4. Filtrare i commenti per categoria
5. Commentare intere sezioni semantiche

---

## Note per Claude Code

- La toolbar deve essere responsive: su WebView strette, collassa i conteggi in un singolo numero con tooltip
- Lo scroll-to-comment deve essere smooth (`scrollIntoView({ behavior: 'smooth', block: 'center' })`)
- L'highlight temporaneo dopo lo scroll usa un'animazione CSS (background flash che sfuma in 1s)
- Il pannello commenti dovrebbe essere ridimensionabile (drag del bordo sinistro)
- Per il layout: flexbox con `flex-shrink: 0` sul pannello commenti
