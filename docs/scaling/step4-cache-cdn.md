# Шаг 4 — Cache-headers + CDN для веба ✅ ПРИМЕНЕНО (2026-07-01)

Кэширование статики TWA. Ассеты Vite уже кэшировались (предыдущий разработчик);
недоставало `no-cache` на `index.html` → после деплоя мог отдаваться старый html.

## Что изменено

Файл: `/opt/linguolab/nginx/conf.d/app.linguolab.conf` (в `main_nginx`, отдаёт
статику из `/opt/linguolab/web/dist`, rsync из `apps/web/dist` при Deploy Web).
В `location /` (SPA-fallback) добавлены `add_header`:

```nginx
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }
```

(3 security-заголовка продублированы, т.к. `add_header` в location отменяет
наследование server-level `add_header`.) Ассеты уже имели:
`location ~* \.(js|css|woff2|svg|png|jpg|webp)$ { expires 1y; Cache-Control public, immutable; }`.

## Итоговое поведение (проверено curl)

| Ресурс | Cache-Control | Эффект |
|---|---|---|
| `index.html` | `no-cache` | деплой подхватывается сразу, без застревания на старых хешах |
| `/assets/*.js|css` | `public, max-age=31536000, immutable` | браузер кэширует на год → повторные открытия TWA не качают бандлы |

CDN: Cloudflare (перед доменом, orange-cloud, origin-cert) кэширует ассеты на эдже —
`cf-cache-status: HIT` по GET (первый MISS был артефактом HEAD-запроса `curl -I`).
Origin разгружен, TWA стартует быстро по миру.

## Откат

```bash
CONF=/opt/linguolab/nginx/conf.d/app.linguolab.conf
cp "$(ls -t $CONF.bak.* | head -1)" "$CONF"
docker exec main_nginx nginx -t && docker exec main_nginx nginx -s reload
```

## Заметки на будущее
- `/locales/*.json` не хешируются и не кэшируются агрессивно — правильно (переводы
  меняются на деплое). Оставлены на эвристике браузера.
- Если CF когда-то покажет `MISS` по GET — проверить в дашборде: Caching Level =
  Standard, Development Mode = OFF, нет Cache Rule с Bypass на `app-linguolab.*`.
