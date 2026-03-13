# Plan Reviewer — Roadmap Agile

**Progetto**: Plan Reviewer (VS Code Extension)
**Autore**: mikeleg
**Data**: 12 Marzo 2026
**Metodologia**: Epic → Story → Task, sprint di ~1 settimana

---

## Mappa delle Epic

```
EPIC 0 ──→ EPIC 1 ──→ EPIC 2 ──→ EPIC 3
 Setup      Capture    Comments    Toolbar
 (P0)       (P0)       (P0)        (P1)
  │                      │
  │                      ▼
  │                    EPIC 4 ──→ EPIC 5
  │                    Prompt     Versioning
  │                    (P0)       (P1)
  │                                 │
  │                                 ▼
  │                    EPIC 6     EPIC 7
  │                    Explorer   Polish
  │                    (P2)       (P2)
  │                      │          │
  └──────────────────────┴──────────┘
                  ▼
            🚀 MARKETPLACE
```

---

## Sprint Plan

| Sprint | Epic | Cosa si ottiene | Stima |
|--------|------|-----------------|-------|
| 1 | **Epic 0** — Scaffolding | Progetto compilante, DB funzionante, WebView shell | 2-3 gg |
| 2 | **Epic 1** — Capture & Render | Cattura piano e lo visualizza | 3-4 gg |
| 3 | **Epic 2** — Commenting | Commenti inline su righe e range | 4-5 gg |
| 4 | **Epic 3** — Toolbar & Nav | Toolbar di review, navigazione commenti, sezioni | 3 gg |
| 5 | **Epic 4** — Prompt Gen | Genera il prompt strutturato dai commenti | 2-3 gg |
| 6-7 | **Epic 5** — Versioning & Diff | Cattura nuove versioni, diff, carry-over commenti | 5-6 gg |
| 8 | **Epic 6** — Explorer | Plan Explorer sidebar, timeline, search, export | 3-4 gg |
| 9 | **Epic 7** — Polish | Settings, shortcuts, onboarding, marketplace | 3-4 gg |

**Totale stimato**: ~26-32 giorni lavorativi (~6-7 settimane)

---

## Milestone di Valore

### 🏁 M1 — "Read-Only Viewer" (dopo Epic 1)
Puoi catturare e visualizzare un piano. Utile per avere un riferimento strutturato, ma non ancora interattivo.

### 🏁 M2 — "Annotated Plan" (dopo Epic 2+3)
Puoi annotare il piano con commenti. Il plugin ha valore come strumento di review personale, anche senza il loop AI.

### 🏁 M3 — "One-Way Loop" (dopo Epic 4)
Puoi generare un prompt strutturato. **Il plugin è utilizzabile end-to-end** anche se il loop è manuale (copia/incolla). Questo è il primo punto in cui puoi usarlo sul lavoro quotidiano.

### 🏁 M4 — "Full Loop" (dopo Epic 5)
Il loop è completo: cattura → review → prompt → ri-cattura → diff → carry-over. **Questo è il prodotto.**

### 🏁 M5 — "Polished Product" (dopo Epic 6+7)
Explorer, storico, settings, onboarding, marketplace. **Il plugin è un prodotto finito.**

---

## Come usare questi piani con Claude Code

Ogni file Epic (`EPIC-XX-*.md`) è progettato per essere **passato direttamente a Claude Code** come contesto di lavoro.

### Workflow consigliato

```bash
# 1. Inizia un nuovo piano
cd plan-reviewer
claude

# 2. Passa l'epic come contesto
> @EPIC-00-project-scaffolding.md Implementa la Story 0.1

# 3. Dopo ogni story, testa manualmente
# 4. Quando l'epic è completata, passa alla successiva
> @EPIC-01-plan-capture-rendering.md Implementa la Story 1.1
```

### Consigli per Claude Code

- **Una story alla volta**: non passare l'intera epic come "fai tutto". Lavora story per story
- **Testa dopo ogni story**: i criteri di accettazione sono la tua checklist
- **Mantieni il contesto**: quando inizi una nuova story, ricorda a Claude Code cosa è già stato implementato
- **Le "Note per Claude Code"** in fondo a ogni epic contengono avvertimenti tecnici specifici — sono lì per evitare problemi noti

### File da tenere nella root del progetto

Copia tutti i file `EPIC-*.md` in una cartella `docs/plans/` nella root del progetto. Claude Code può leggerli quando serve contesto.

```
plan-reviewer/
├── docs/
│   └── plans/
│       ├── ROADMAP.md          (questo file)
│       ├── EPIC-00-*.md
│       ├── EPIC-01-*.md
│       ├── ...
│       └── EPIC-07-*.md
├── src/
└── ...
```

---

## Priorità e Scope

Le **Epic 0-4 sono il core** — senza di esse il plugin non ha senso. Sono tutte P0 o P1.

Le **Epic 5** (versioning/diff) è P1 — è ciò che rende il plugin davvero potente vs. un semplice notepad.

Le **Epic 6-7** sono P2 — migliorano l'esperienza ma il plugin funziona anche senza.

Se vuoi rilasciare early, **dopo l'Epic 4 hai già un prodotto utilizzabile**. Le epic 5-7 possono venire come aggiornamenti successivi.

---

*Roadmap generata durante brainstorming collaborativo su Claude.ai — 12 Marzo 2026*
