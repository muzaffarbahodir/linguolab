# Дизайн-токены LinguoLab

Единый источник цветов. Цель — убрать дублирование (`#6C5CE7` и
`rgba(255,255,255,0.0x)` были раскиданы по ~600 местам) и сделать смену темы
правкой одного места, а не find/replace по всему проекту.

## Где что лежит

| Что | Где | Как использовать |
|-----|-----|------------------|
| Статусы (класс/платёж/триал): цвет + ярлык + иконка | `src/lib/status.ts` | `CLASS_STATUS[s]` → `{color, labelKey, icon}` |
| Бренд, поверхности, границы, текст, статус-цвета | `tailwind.config.js` → `theme.colors` | Tailwind-классы |
| Тема Telegram (форс dark) | `src/main.tsx` → `DARK_THEME` | CSS-vars `--tg-theme-*` |
| Glass-эффекты | `src/styles/index.css` | классы `.glass*` |

## Tailwind-токены (используй вместо хардкода)

```
bg-brand            #6C5CE7  — основной бренд
text-brand-400      #8B5CF6  — светлый акцент

bg-surface          rgba(255,255,255,0.04)  — фон карточки/строки
bg-surface-2        rgba(255,255,255,0.07)  — фон чуть светлее
border-hairline     rgba(255,255,255,0.08)  — тонкая граница
text-muted          rgba(255,255,255,0.45)  — приглушённый текст
text-faint          rgba(255,255,255,0.30)  — едва заметный текст

text-ok / bg-ok     #10B981  — успех/зелёный
text-warn           #F59E0B  — предупреждение/жёлтый
text-danger         #EF4444  — ошибка/красный
text-info           #3B82F6  — инфо/синий
```

## Правило

**Новый код — без хардкода hex и `rgba(255,255,255,...)`.** Бери токен.
Нужного нет — добавь в `tailwind.config.js`, не в инлайн-стиль.

## Миграция (инкрементально, чтобы не ловить регрессии)

Старый код переносим по одному файлу, проверяя визуально:

```diff
- style={{ color: 'rgba(255,255,255,0.45)' }}      → className="text-muted"
- style={{ background: 'rgba(255,255,255,0.04)' }}  → className="bg-surface"
- style={{ border: '1px solid rgba(255,255,255,0.08)' }} → className="border border-hairline"
- style={{ color: '#6C5CE7' }}                      → className="text-brand"
```

Статусы → через `lib/status.ts` (см. `Courses.tsx`, `Payment.tsx` как образец).

**Сделано:** статус-цвета централизованы (`lib/status.ts`), токены заведены.
**Осталось:** перенос ~800 инлайн-стилей на классы — по файлу, по мере правок.
