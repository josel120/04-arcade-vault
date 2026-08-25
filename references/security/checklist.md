## Checklist de seguridad básico

  - [ ] RLS: Row Level Security habilitado en las tablas: `game_stats`,`game_leaderboards`,`profiles`,`games` y `scores`
  - [ ] Minimum password length — mínimo 8 caracteres
  - [ ] Leaked password protection — (el warning 4)
  - [ ] Max signup rate — limitar signups por IP (anti-bot)
  - [ ] Headers de seguridad en Next.js
  
  Ej:

```ts
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// En la config de Next.js:
headers: async () => [
  { source: '/(.*)', headers: securityHeaders }
]
```

## Por el lado de Supabase:

| name                            | title                               | level | facing   | categories   | description                                       | detail                                                                                                                                   | cache_key                       | remediation                                                                                              | metadata                        |
| ------------------------------- | ----------------------------------- | ----- | -------- | ------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------- |
| auth_leaked_password_protection | Leaked Password Protection Disabled | WARN  | EXTERNAL | ["SECURITY"] | Leaked password protection is currently disabled. | Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security. | auth_leaked_password_protection | https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection | {"type":"auth","entity":"Auth"} |
