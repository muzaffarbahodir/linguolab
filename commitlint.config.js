/**
 * Conventional Commits — обязательны.
 * Формат: <type>(<scope>)?: <subject>
 * Примеры:
 *   feat(auth): telegram initData verification + JWT issuance
 *   fix(payments): correct HMAC-SHA1 signature for Click webhooks
 *   chore(repo): init monorepo with web/api/admin skeletons
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // новая фича
        'fix', // баг-фикс
        'chore', // конфиги, зависимости, инфра
        'docs', // документация
        'test', // тесты
        'refactor', // рефакторинг без изменения поведения
        'perf', // оптимизация
        'ci', // CI/CD изменения
        'build', // сборка
        'style', // форматирование
        'revert', // откат
      ],
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
};
