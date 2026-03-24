# Piano: Sistema di Autenticazione

## Overview

Il sistema di autenticazione gestirà il login degli utenti tramite JWT (JSON Web Tokens).
L'accesso sarà protetto con HTTPS e i token avranno una scadenza di 24 ore.
Il refresh token avrà durata di 30 giorni e sarà rotante.

## Requisiti

### Requisiti funzionali

- L'utente deve poter fare login con email e password
    - prova
- Il sistema deve emettere un access token (JWT, 24h) e un refresh token (30d)
- Il logout deve invalidare i token attivi
- Il rate limiting deve bloccare dopo 5 tentativi falliti in 10 minuti

### Requisiti non funzionali

- Latenza del login < 200ms
- Disponibilità del 99.9%

## Architettura

### Componenti

Il sistema è composto da:
1. `AuthService` — logica di business per login/logout
2. `TokenRepository` — persistenza dei refresh token
3. `RateLimiter` — contatore tentativi falliti (Redis)

### Flusso di autenticazione

```
Client → POST /auth/login → AuthService → DB lookup → emit JWT
Client → POST /auth/refresh → AuthService → TokenRepository → emit new JWT
Client → POST /auth/logout → AuthService → TokenRepository.revoke()
```

### Tecnologie

- Node.js + Express
- PostgreSQL per gli utenti
- Redis per rate limiting e token blacklist
- bcrypt per l'hashing delle password

## Implementazione

### Fase 1 — Setup infrastruttura

1. Configurare PostgreSQL con tabella `users` (id, email, password_hash, created_at)
2. Configurare Redis
3. Creare le migrazioni DB

### Fase 2 — Core AuthService

1. Implementare `login(email, password): { accessToken, refreshToken }`
2. Implementare `refresh(refreshToken): { accessToken }`
3. Implementare `logout(refreshToken): void`

### Fase 3 — API endpoints

1. `POST /auth/login`
2. `POST /auth/refresh`
3. `POST /auth/logout`
4. `GET /auth/me` (endpoint protetto di test)
