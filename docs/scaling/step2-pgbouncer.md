# Шаг 2 — pgbouncer (пул коннектов) ✅ ПРИМЕНЕНО (2026-07-01)

Пул соединений к Postgres перед API. Зачем при 100k: контрольная точка соединений,
поглощение всплесков, защита `linguolab_postgres` от исчерпания коннектов (лимит 100),
запас под будущие реплики. Образ `edoburu/pgbouncer` — тот же, что у соседнего
`hr_pgbouncer` (проверен на этом хосте).

## Режим: session (сознательно)

Prisma в **transaction**-mode требует `directUrl` в `schema.prisma` + `?pgbouncer=true`
(риск сломать CI/локалку). **Session**-mode: миграции (advisory lock держится всю
сессию) и prepared statements работают без правок схемы; откат = одна строка в `.env`.
Transaction-mode — апгрейд на потом, когда число коннектов реально станет узким местом
(много реплик); тогда добавить Prisma `directUrl` + `?pgbouncer=true`.

## Что применено на проде

1. Сервис `linguolab_pgbouncer` (session, `:6432`, сеть `linguolab_internal`,
   scram-sha-256, `MAX_CLIENT_CONN=1000`, `DEFAULT_POOL_SIZE=40`) — в
   `/opt/linguolab/compose/docker-compose.override.yml` (в репо
   `infra/compose/docker-compose.override.yml`).
2. В `/opt/linguolab/compose/.env`: `DATABASE_URL` хост изменён
   `linguolab_postgres:5432` → `linguolab_pgbouncer:6432` (пароль/бд те же).
   `.env` в репо не хранится — это правка только на сервере.
3. Обе реплики API прокатаны на новый URL (по очереди, с проверкой).

## Проверка (пройдена)

- Гейт: `psql <db-через-pgbouncer> -c 'select 1'` → `1`.
- Обе реплики `healthy`, `Prisma connected to database`, health 200, ошибок БД нет.

## Откат

```bash
cd /opt/linguolab/compose
cp "$(ls -t .env.bak.* | head -1)" .env          # вернуть DATABASE_URL на прямой Postgres
docker compose up -d --no-deps --force-recreate linguolab_api linguolab_api_2
# при желании убрать контейнер:
# docker compose stop linguolab_pgbouncer && docker compose rm -f linguolab_pgbouncer
```

## Заметки
- Деплой не затронут: миграции идут через session-mode pgbouncer (advisory lock ок).
- Cold-boot: API не имеет `depends_on` на pgbouncer → при полном рестарте сервера
  может пару раз перезапуститься, пока pgbouncer поднимается (restart: unless-stopped
  само выправит). Не критично; при желании добавить depends_on позже.
