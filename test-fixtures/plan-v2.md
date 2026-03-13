# Piano: Sistema di Autenticazione

## Overview

Il sistema di autenticazione gestirà il login degli utenti tramite JWT (JSON Web Tokens).
L'accesso sarà protetto con HTTPS e i token avranno una scadenza di 24 ore.
Il refresh token avrà durata di 30 giorni e sarà rotante.

## Requisiti

### Requisiti funzionali

- L'utente deve poter fare login con email e password
- Il sistema deve emettere un access token (JWT, 15 minuti) e un refresh token (7 giorni)
- Il logout deve invalidare i token attivi
- Il rate limiting deve bloccare dopo 3 tentativi falliti in 5 minuti
- Supporto per OAuth2 (Google, GitHub) come metodo alternativo

### Requisiti non funzionali

- Latenza del login < 100ms (ridotta da 200ms)
- Disponibilità del 99.95%
- Conformità GDPR per i dati degli utenti

## Architettura

### Componenti

Il sistema è stato riprogettato con una separazione più netta:
1. `AuthService` — orchestrazione del flusso di autenticazione
2. `JwtService` — emissione e validazione dei token (estratto da AuthService)
3. `TokenRepository` — persistenza dei refresh token
4. `RateLimiter` — contatore tentativi falliti (Redis)
5. `OAuthAdapter` — integrazione con provider OAuth2 esterni

### Flusso di autenticazione

```
Client → POST /auth/login → AuthService → JwtService → emit JWT
Client → POST /auth/refresh → AuthService → TokenRepository → JwtService → emit new JWT
Client → POST /auth/logout → AuthService → TokenRepository.revoke()
Client → GET /auth/oauth/google → OAuthAdapter → AuthService → emit JWT
```

### Tecnologie

- Node.js + Express
- PostgreSQL per gli utenti
- Redis per rate limiting e token blacklist
- bcrypt per l'hashing delle password
- passport.js per OAuth2

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
