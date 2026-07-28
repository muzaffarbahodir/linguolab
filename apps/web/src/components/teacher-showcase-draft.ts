import type { SpokenLanguage, TeacherProfile, UpdateTeacherProfileInput } from '../api/teachers';

/**
 * Черновик витрины в том виде, в каком его удобно держать в полях ввода:
 * опыт и направления — строки, потому что человек их набирает, а не выбирает.
 *
 * Лежит отдельно от компонента: иначе react-refresh не может обновлять форму
 * без перезагрузки страницы, когда в файле рядом с компонентом живут функции.
 */
export interface ShowcaseDraft {
  headline: string;
  country: string;
  experience: string;
  intro_video_url: string;
  /** Направления через запятую. */
  specializations: string;
  speaks: SpokenLanguage[];
}

export function emptyShowcase(): ShowcaseDraft {
  return {
    headline: '',
    country: '',
    experience: '',
    intro_video_url: '',
    specializations: '',
    speaks: [],
  };
}

export function showcaseFromProfile(p: TeacherProfile): ShowcaseDraft {
  return {
    headline: p.headline ?? '',
    country: p.country ?? '',
    experience: p.experience_years !== null ? String(p.experience_years) : '',
    intro_video_url: p.intro_video_url ?? '',
    specializations: p.specializations.join(', '),
    speaks: p.speaks,
  };
}

/** Собирает часть тела PATCH-запроса из черновика. */
export function showcaseToPayload(d: ShowcaseDraft): Partial<UpdateTeacherProfileInput> {
  const years = parseInt(d.experience, 10);
  return {
    headline: d.headline.trim() || undefined,
    country: d.country.trim() || undefined,
    experience_years: Number.isFinite(years) && years >= 0 ? years : undefined,
    // Пустая строка — это «убрать видео», поэтому null, а не undefined:
    // undefined бэк пропустит мимо и старая ссылка останется.
    intro_video_url: d.intro_video_url.trim() ? d.intro_video_url.trim() : null,
    specializations: d.specializations
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8),
    speaks: d.speaks.filter((s) => s.name.trim()),
  };
}
