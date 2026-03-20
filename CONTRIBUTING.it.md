# Come contribuire a Plan Reviewer

🇬🇧 [English](CONTRIBUTING.md) | 🇮🇹 [Italiano](CONTRIBUTING.it.md)

Grazie per il tuo interesse nel contribuire! Il progetto è attualmente in **alpha** e accoglie contributi di ogni tipo — segnalazioni di bug, richieste di funzionalità, miglioramenti alla documentazione e modifiche al codice.

## Regole di base

- **Tutti i contributi devono passare attraverso una Pull Request.** I push diretti su `main` non sono consentiti.
- Ogni PR richiede almeno una revisione da parte di un maintainer prima di poter essere unita.
- Mantieni le PR focalizzate e piccole — una singola modifica logica per PR rende le revisioni più veloci.
- Sii rispettoso e costruttivo in tutte le discussioni.

## Come iniziare

1. Fai un fork del repository e crea il tuo branch da `main`:
   ```bash
   git checkout -b feat/mia-funzionalita
   # oppure
   git checkout -b fix/mio-bug
   ```
2. Installa le dipendenze:
   ```bash
   npm install
   ```
3. Apporta le modifiche e verificale:
   ```bash
   npm run compile   # type-check
   npm run lint      # ESLint
   npm run test      # test unitari
   ```
4. Esegui il commit con un messaggio chiaro e descrittivo.
5. Fai push del branch e apri una Pull Request verso `main`.

## Nomenclatura dei branch

| Tipo | Pattern | Esempio |
|------|---------|---------|
| Funzionalità | `feat/<breve-descrizione>` | `feat/esporta-commenti` |
| Bug fix | `fix/<breve-descrizione>` | `fix/offset-diff-engine` |
| Documentazione | `docs/<breve-descrizione>` | `docs/aggiorna-readme` |
| Manutenzione | `chore/<breve-descrizione>` | `chore/aggiorna-deps` |

## Checklist per la Pull Request

Prima di inviare una PR, assicurati che:

- [ ] `npm run compile` passi senza errori
- [ ] `npm run lint` non riporti nuovi avvisi o errori
- [ ] `npm run test` passi
- [ ] La descrizione della PR spieghi **cosa** è cambiato e **perché**
- [ ] Eventuali nuove API o comportamenti pubblici siano documentati

## Segnalare bug

Apri una Issue GitHub con:
- Titolo e descrizione chiari
- Passi per riprodurre il problema
- Comportamento atteso vs comportamento reale
- Versione di VS Code, versione dell'estensione e sistema operativo

## Proporre funzionalità

Apri una Issue GitHub con il tag `enhancement` indicando:
- Il problema che vuoi risolvere
- La soluzione o l'approccio proposto
- Le alternative che hai considerato

## Licenza

Contribuendo accetti che i tuoi contributi siano rilasciati sotto la [Licenza MIT](LICENSE).
