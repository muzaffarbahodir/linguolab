/**
 * RoleGate — первые экраны нового пользователя.
 *
 * Шаг 1 — язык. Раньше его не спрашивали, а угадывали по language_code из
 * Telegram: у человека с английским интерфейсом мессенджера первый экран
 * оказывался на английском, а всё остальное — на русском. Угадывание убрано,
 * спрашиваем прямо.
 *
 * Шаг 2 — роль: учусь сам / родитель / преподаватель.
 *
 * Преподаватель идёт своей веткой: заведённого заранее пускаем в кабинет
 * сразу, остальным — анкета, которая уходит менеджеру.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';

import {
  useOnboard,
  useTeacherStatus,
  useSubmitTeacherApplication,
  type TeacherStatus,
} from '../api/users';
import { useAuthStore } from '../store/auth';
import { LANGUAGES, applyLocale, useLanguage } from '../hooks/useLanguage';
import { Button, Card, ChoiceCard, cx } from '../components/ui';
import {
  TeacherDocumentUpload,
  type DocumentKind,
  type UploadedDocument,
} from '../components/TeacherDocumentUpload';

type Step = 'language' | 'role' | 'teacher';

export function RoleGate({ onBrowse }: { onBrowse?: () => void }) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const onboard = useOnboard();
  const teacherStatus = useTeacherStatus();
  const login = useAuthStore((s) => s.login);

  const [step, setStep] = useState<Step>('language');
  const [busy, setBusy] = useState<'STUDENT' | 'PARENT' | 'TEACHER' | null>(null);
  const [status, setStatus] = useState<TeacherStatus | null>(null);

  /** Перелогин подхватывает новую роль и is_active — гейт исчезает сам. */
  const relogin = async () => {
    try {
      await login(WebApp.initData);
    } catch {
      window.location.reload();
    }
  };

  const chooseClient = (role: 'STUDENT' | 'PARENT') => {
    if (busy) return;
    setBusy(role);
    onboard.mutate(role, {
      onSuccess: async () => {
        WebApp.HapticFeedback?.notificationOccurred?.('success');
        await relogin();
      },
      onError: () => {
        setBusy(null);
        WebApp.showAlert(t('rolegate.error'));
      },
    });
  };

  const chooseTeacher = () => {
    if (busy) return;
    setBusy('TEACHER');
    teacherStatus.mutate(undefined, {
      onSuccess: async (res) => {
        // Заведён заранее — анкету спрашивать незачем, человека уже ждали.
        if (res.state === 'already') {
          WebApp.HapticFeedback?.notificationOccurred?.('success');
          await relogin();
          return;
        }
        setStatus(res);
        setBusy(null);
        setStep('teacher');
      },
      onError: () => {
        setBusy(null);
        WebApp.showAlert(t('rolegate.error'));
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-[90] overflow-y-auto px-6 py-10"
      style={{ background: 'var(--bg)' }}
    >
      {step === 'language' && (
        <div className="flex min-h-full flex-col justify-center gap-6">
          {/* Заголовок сразу на трёх языках: человек ещё не выбрал язык, и
              показывать этот экран на угаданном — та же ошибка, от которой мы
              здесь и уходим. */}
          <h1 className="text-center text-2xl font-bold leading-snug">
            Выберите язык
            <span className="text-muted mt-1 block text-base font-medium">
              Tilni tanlang · Choose language
            </span>
          </h1>

          <div className="flex flex-col gap-3">
            {LANGUAGES.map((lang) => (
              <ChoiceCard
                key={lang.code}
                title={lang.label}
                art={lang.flag}
                tint={locale === lang.code ? '#6C5CE7' : undefined}
                onClick={() => {
                  applyLocale(lang.code);
                  WebApp.HapticFeedback?.selectionChanged?.();
                  setStep('role');
                }}
              />
            ))}
          </div>
        </div>
      )}

      {step === 'role' && (
        <div className="flex min-h-full flex-col justify-center gap-6">
          <div className="text-center">
            <h1 className="text-display mb-2">{t('rolegate.title')}</h1>
            <p className="text-muted text-sm">{t('rolegate.subtitle')}</p>
          </div>

          <div className="flex flex-col gap-3">
            <ChoiceCard
              title={t('rolegate.student_title')}
              description={t('rolegate.student_desc')}
              art="🎓"
              tint="#6C5CE7"
              onClick={() => chooseClient('STUDENT')}
            />
            <ChoiceCard
              title={t('rolegate.parent_title')}
              description={t('rolegate.parent_desc')}
              art="👨‍👧"
              tint="#10B981"
              onClick={() => chooseClient('PARENT')}
            />
            <ChoiceCard
              title={t('rolegate.teacher_title')}
              description={t('rolegate.teacher_desc')}
              art="👨‍🏫"
              tint="#0EA5E9"
              onClick={chooseTeacher}
            />
          </div>

          {busy && <p className="text-muted text-center text-sm">{t('rolegate.saving')}</p>}

          {onBrowse && !busy && (
            <button
              onClick={onBrowse}
              className="press text-brand-400 text-center text-sm font-semibold underline"
            >
              {t('rolegate.browse')}
            </button>
          )}

          <p className="text-faint text-center text-xs">{t('rolegate.hint')}</p>
        </div>
      )}

      {step === 'teacher' && (
        <TeacherStep
          status={status}
          onBack={() => setStep('role')}
          onSubmitted={() => setStatus({ state: 'pending' })}
        />
      )}
    </div>
  );
}

/**
 * Ветка преподавателя: либо «заявка на рассмотрении», либо анкета.
 *
 * Роль по анкете не выдаётся — решение принимает человек в центре. Форма лишь
 * доводит заявку до менеджера в рабочем виде, вместо переписки в личных.
 */
function TeacherStep({
  status,
  onBack,
  onSubmitted,
}: {
  status: TeacherStatus | null;
  onBack: () => void;
  onSubmitted: () => void;
}) {
  const submit = useSubmitTeacherApplication();

  const [subject, setSubject] = useState('');
  const [age, setAge] = useState('');
  const [experience, setExperience] = useState('');
  const [certificates, setCertificates] = useState('');
  const [about, setAbout] = useState('');
  const [format, setFormat] = useState<'ONLINE' | 'OFFLINE' | null>(null);
  const [docs, setDocs] = useState<Partial<Record<DocumentKind, UploadedDocument>>>({});

  const setDoc = (kind: DocumentKind) => (doc: UploadedDocument | null) =>
    setDocs((prev) => ({ ...prev, [kind]: doc ?? undefined }));

  if (status?.state === 'pending') {
    return (
      <div className="flex min-h-full flex-col justify-center gap-5 text-center">
        <p className="text-5xl">⏳</p>
        <h1 className="text-2xl font-bold">Заявка на рассмотрении</h1>
        <p className="text-muted text-sm leading-relaxed">
          Мы получили вашу анкету и свяжемся с вами в Telegram. Обычно это занимает пару рабочих
          дней.
        </p>
        <Button variant="secondary" onClick={onBack}>
          Назад
        </Button>
      </div>
    );
  }

  // Онлайн-преподаватель в офис не приедет — удостоверение личности он тоже
  // присылает файлом. Очному паспорт проще показать при встрече.
  const requiredDocs: DocumentKind[] =
    format === 'ONLINE' ? ['PASSPORT', 'DIPLOMA', 'PHOTO'] : ['DIPLOMA', 'PHOTO'];

  const docsReady = format !== null && requiredDocs.every((k) => docs[k]);
  const canSubmit = subject.trim().length > 1 && docsReady && !submit.isPending;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div>
        <h1 className="text-2xl font-bold leading-snug">Расскажите о себе</h1>
        <p className="text-muted mt-2 text-sm">
          Анкета уйдёт менеджеру — он свяжется с вами в Telegram.
        </p>
      </div>

      {status?.previous_rejection && (
        <Card className="border-warn/30 bg-warn/10">
          <p className="text-xs leading-snug">
            Прошлая заявка отклонена: {status.previous_rejection}
          </p>
        </Card>
      )}

      {/* Формат спрашиваем первым: от него зависит, какие документы понадобятся,
          и показывать список до ответа бессмысленно. */}
      <div>
        <span className="text-muted mb-1.5 block text-xs font-semibold">
          Как планируете работать<span className="text-danger"> *</span>
        </span>
        <div className="flex gap-2">
          {(
            [
              ['ONLINE', '💻 Онлайн'],
              ['OFFLINE', '🏫 Очно'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFormat(value)}
              className={cx(
                'press flex-1 rounded-xl border py-2.5 text-sm font-semibold',
                format === value
                  ? 'border-brand/40 bg-brand/15 text-brand-400'
                  : 'border-hairline bg-surface-2 text-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Field label="Что готовы преподавать" required>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Английский, IELTS, немецкий…"
          className={INPUT}
        />
      </Field>

      <div className="flex gap-3">
        <Field label="Возраст" className="flex-1">
          <input
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 2))}
            inputMode="numeric"
            placeholder="25"
            className={INPUT}
          />
        </Field>
        <Field label="Опыт, лет" className="flex-1">
          <input
            value={experience}
            onChange={(e) => setExperience(e.target.value.replace(/\D/g, '').slice(0, 2))}
            inputMode="numeric"
            placeholder="3"
            className={INPUT}
          />
        </Field>
      </div>

      <Field label="Сертификаты и дипломы">
        <textarea
          value={certificates}
          onChange={(e) => setCertificates(e.target.value)}
          rows={2}
          placeholder="CELTA, IELTS 8.0, диплом филфака…"
          className={INPUT}
        />
      </Field>

      <Field label="О себе">
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={3}
          placeholder="Где преподавали, с кем работали, чего хотите"
          className={INPUT}
        />
      </Field>

      {format && (
        <div className="border-hairline bg-surface flex flex-col gap-3 rounded-2xl border p-4">
          <p className="text-sm font-semibold">Документы</p>

          <TeacherDocumentUpload
            kind="DIPLOMA"
            label="Диплом об образовании"
            required
            value={docs.DIPLOMA}
            onChange={setDoc('DIPLOMA')}
          />
          <TeacherDocumentUpload
            kind="PHOTO"
            label="Фото для профиля"
            required
            value={docs.PHOTO}
            onChange={setDoc('PHOTO')}
          />
          {format === 'ONLINE' && (
            <TeacherDocumentUpload
              kind="PASSPORT"
              label="Паспорт или ID"
              required
              value={docs.PASSPORT}
              onChange={setDoc('PASSPORT')}
            />
          )}
          <TeacherDocumentUpload
            kind="CERTIFICATE"
            label="Сертификаты"
            value={docs.CERTIFICATE}
            onChange={setDoc('CERTIFICATE')}
          />

          {format === 'OFFLINE' && (
            <p className="bg-warn/10 text-warn rounded-xl p-3 text-xs leading-snug">
              Оригиналы паспорта и диплома привезите в офис — покажете их на встрече. Загружать их
              сюда не нужно.
            </p>
          )}
        </div>
      )}

      {submit.isError && (
        <p className="text-danger text-xs">Не получилось отправить — попробуйте ещё раз</p>
      )}

      <Button
        size="lg"
        disabled={!canSubmit}
        loading={submit.isPending}
        onClick={() =>
          submit.mutate(
            {
              subject: subject.trim(),
              work_format: format ?? 'ONLINE',
              documents: Object.values(docs).filter(Boolean) as UploadedDocument[],
              age: age ? Number(age) : null,
              experience_years: experience ? Number(experience) : null,
              certificates: certificates.trim() || null,
              about: about.trim() || null,
            },
            {
              onSuccess: () => {
                WebApp.HapticFeedback?.notificationOccurred?.('success');
                onSubmitted();
              },
            },
          )
        }
      >
        Отправить заявку
      </Button>

      <button onClick={onBack} className="press text-muted py-2 text-sm font-medium">
        ← Выбрать другую роль
      </button>
    </div>
  );
}

const INPUT =
  'w-full rounded-xl border border-hairline bg-surface-2 px-3 py-2.5 text-sm ' +
  'text-[color:var(--text)] outline-none placeholder:text-faint';

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={className}>
      <span className="text-muted mb-1.5 block text-xs font-semibold">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
    </label>
  );
}
