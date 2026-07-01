# Шаг 1 — Реплики API + rolling-выкат ✅ ПРИМЕНЕНО (2026-07-01)

> Реализовано на проде: вторая реплика `linguolab_api_2` добавлена через
> `docker-compose.override.yml` (обе реплики делят сетевой алиас `linguolab_api`),
> в nginx добавлен `proxy_next_upstream`, `deploy-api.yml` переведён на rolling.
> Тест zero-downtime пройден: 40/40 запросов = 200 при рестарте реплики.
> Ниже — исходный рунбук (для истории/воспроизведения на другом сервере).

**Цель:** запустить 2 реплики API за nginx-upstream →
1. горизонтальное масштабирование (×2 пропускная способность, задел под рост);
2. **zero-downtime деплой** — новая реплика поднимается до убийства старой, nginx
   переключается на живую → пользователь больше не видит окно 502 при выкате.

Работает на обычном `docker compose` (без Swarm/K8s). Память: 2×~200 МБ ≈ 400 МБ
(на сервере ~8.8 ГБ свободно — с запасом).

> ⚠️ Ничего не применено. Правки затрагивают **живой сервер** и общий `main_nginx`.
> Применяем вместе после ревью.

---

## 1. Compose — две реплики с ОБЩИМ сетевым алиасом

Файл на сервере: `/opt/linguolab/compose/docker-compose.yml` (и репо
`infra/compose/docker-compose.yml`). Заменить сервис `linguolab_api` на две реплики
с YAML-якорем. Ключевое — **обе реплики получают алиас `linguolab_api` в сети
`shared_web`**, тогда Docker-DNS отдаёт оба IP на имя `linguolab_api`, а текущий
`proxy_pass http://linguolab_api:3000` в nginx уже балансирует по ним (round-robin).

```yaml
  linguolab_api_1: &linguolab_api
    image: ghcr.io/muzaffarbahodir/linguolab-api:${API_TAG:-latest}
    container_name: linguolab_api_1
    restart: unless-stopped
    env_file: .env
    networks:
      linguolab_internal:
      shared_web:
        aliases:
          - linguolab_api # общий алиас → DNS round-robin по обеим репликам
    depends_on:
      linguolab_postgres:
        condition: service_healthy
      linguolab_redis:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://127.0.0.1:3000/health']
      interval: 15s
      timeout: 5s
      start_period: 40s
      retries: 3

  linguolab_api_2:
    <<: *linguolab_api
    container_name: linguolab_api_2
```

Убрали единый `container_name: linguolab_api` (мешал двум инстансам), но имя
`linguolab_api` сохранили как **алиас** → nginx-конфиг менять для резолва НЕ нужно.

Миграции: CMD образа уже идемпотентен (`prisma migrate deploy && node`), а Prisma
берёт advisory-lock на миграцию → две реплики не конфликтуют. При rolling-выкате они
и так стартуют по очереди (реплика_1 мигрирует, реплика_2 видит «нет новых»).
**Условие безопасности:** миграции только аддитивные (ADD COLUMN/TABLE) — как сейчас.
Деструктивные (DROP/RENAME) с rolling несовместимы (старый код на реплике_2 ещё жив).

---

## 2. main_nginx — добавить только `proxy_next_upstream` (3 строки × 2 локации)

Файл: `/etc/nginx/conf.d/linguolab/api.linguolab.conf`. `upstream{}` НЕ нужен —
резолв уже динамический через `$upstream`. В обе локации (`location /` и webhook)
после `proxy_read_timeout` добавить:

```nginx
        # Реплика перезапускается/недоступна → молча уходим на живую. Убирает 502 при деплое.
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_next_upstream_tries 2;
        proxy_connect_timeout 3s;
```

Итоговый `location /`:

```nginx
    location / {
        set $upstream http://linguolab_api:3000;
        proxy_pass         $upstream;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Connection "";
        proxy_read_timeout 60s;
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_next_upstream_tries 2;
        proxy_connect_timeout 3s;
    }
```

Проверка: `docker exec main_nginx nginx -t` → `docker exec main_nginx nginx -s reload`
(reload без даунтайма, другие vhost не затронуты).

---

## 3. deploy-api.yml — rolling вместо recreate

Заменить шаг «Pull & restart» на последовательный выкат реплик (правим ПОСЛЕ того,
как на сервере появятся `linguolab_api_1/2`, иначе деплой сломается):

```bash
cd /opt/linguolab/compose
sed -i '/^API_TAG=/d' .env && echo "API_TAG=${SHA}" >> .env
docker compose pull linguolab_api_1 linguolab_api_2

# Реплика 1 — обновляем, ждём health. Реплика 2 (старый образ) держит трафик.
docker compose up -d --no-deps linguolab_api_1
for i in $(seq 1 20); do
  h=$(docker inspect -f '{{.State.Health.Status}}' linguolab_api_1 2>/dev/null || echo starting)
  [ "$h" = "healthy" ] && break; sleep 3
done

# Реплика 2 — теперь обновляем её. Реплика 1 (новый образ) держит трафик.
docker compose up -d --no-deps linguolab_api_2
for i in $(seq 1 20); do
  h=$(docker inspect -f '{{.State.Health.Status}}' linguolab_api_2 2>/dev/null || echo starting)
  [ "$h" = "healthy" ] && break; sleep 3
done
```

Шаг миграции: `docker exec linguolab_api_1 node_modules/.bin/prisma migrate deploy`
(любая одна реплика; заменить прежний `docker exec linguolab_api ...`).

---

## 4. Порядок применения (вместе, ~10 минут)

1. Обновить `docker-compose.yml` на сервере (две реплики).
2. `docker compose up -d linguolab_api_1 linguolab_api_2` — поднять обе.
   Проверить `docker ps` → обе `healthy`.
3. Добавить `upstream` + правку `location` в `main_nginx`, `nginx -t`, `nginx -s reload`.
4. Проверить: `curl -sI https://api-linguolab.muzaffarbahodir.uz/health` → 200.
5. Обновить `deploy-api.yml` (rolling) и запушить.
6. **Тест zero-downtime:** во время следующего деплоя крутить
   `while true; do curl -s -o /dev/null -w "%{http_code}\n" .../health; sleep 0.5; done`
   — должны быть только 200, без 502.

---

## 5. Откат (мгновенный)

- **nginx:** вернуть `proxy_pass http://linguolab_api:3000;` + убрать upstream, reload.
- **compose:** вернуть один сервис `linguolab_api` с прежним `container_name`,
  `docker compose up -d linguolab_api`.
- **образ:** `API_TAG=<прежний_SHA>` в `.env` + re-roll.

Старый и новый варианты не конфликтуют по данным (та же БД/Redis) — откат безопасен.

---

## Заметки на будущее
- 3-я реплика — просто добавить `linguolab_api_3` (якорь) + строку в upstream.
- Когда реплик станет >3 и появится второй сервер — вот тогда точка входа в
  Docker Swarm / K8s (см. верхнеуровневый разбор). Сейчас рано.
```
