/**
 * Приём просмотров экранов.
 *
 * Эндпоинт открыт любому авторизованному студенту и вызывается чаще всех
 * остальных, поэтому проверяем две вещи: что в базу не попадает лишнее (в
 * query-строке живут идентификаторы и поисковые запросы) и что пакет нельзя
 * раздуть до произвольного размера.
 */
import { Test, TestingModule } from '@nestjs/testing';

import { AnalyticsService } from '../analytics.service';
import { PageViewController } from '../page-view.controller';

const mockAnalytics = { track: jest.fn().mockResolvedValue(undefined) };
const USER = { id: 'u1', role: 'STUDENT' } as never;

function trackedPaths(): string[] {
  return mockAnalytics.track.mock.calls
    .filter((c) => c[0] === 'page_view')
    .map((c) => c[1].properties.path as string);
}

describe('PageViewController', () => {
  let controller: PageViewController;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockAnalytics.track.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PageViewController],
      providers: [{ provide: AnalyticsService, useValue: mockAnalytics }],
    }).compile();

    controller = module.get(PageViewController);
  });

  it('пишет по событию на каждый путь пакета', async () => {
    await controller.track({ paths: ['/catalog', '/profile'] }, USER);
    expect(trackedPaths()).toEqual(['/catalog', '/profile']);
  });

  it('привязывает событие к пользователю и его роли', async () => {
    await controller.track({ paths: ['/catalog'] }, USER);
    const opts = mockAnalytics.track.mock.calls[0]![1];
    expect(opts.userId).toBe('u1');
    expect(opts.userRole).toBe('STUDENT');
  });

  it('отбрасывает query-строку — там идентификаторы и поисковые запросы', async () => {
    await controller.track({ paths: ['/search?q=ielts&user=u1'] }, USER);
    expect(trackedPaths()).toEqual(['/search']);
  });

  it('отбрасывает хеш', async () => {
    await controller.track({ paths: ['/class/abc#lessons'] }, USER);
    expect(trackedPaths()).toEqual(['/class/abc']);
  });

  it('игнорирует всё, что не выглядит путём', async () => {
    await controller.track({ paths: ['https://evil.example/x', 'catalog', '', '   '] }, USER);
    expect(trackedPaths()).toEqual([]);
  });

  it('обрезает пакет, а не принимает сколько прислали', async () => {
    const paths = Array.from({ length: 100 }, (_, i) => `/p${i}`);
    await controller.track({ paths }, USER);
    expect(trackedPaths()).toHaveLength(20);
  });

  it('обрезает слишком длинный путь', async () => {
    await controller.track({ paths: ['/' + 'a'.repeat(500)] }, USER);
    expect(trackedPaths()[0]!.length).toBe(200);
  });

  it('не падает на мусоре вместо тела', async () => {
    await expect(controller.track({ paths: null as never }, USER)).resolves.toBeUndefined();
    await expect(controller.track({} as never, USER)).resolves.toBeUndefined();
    expect(trackedPaths()).toEqual([]);
  });

  it('пропускает нестроковые элементы, не теряя остальные', async () => {
    await controller.track({ paths: ['/a', 42 as never, '/b'] }, USER);
    expect(trackedPaths()).toEqual(['/a', '/b']);
  });
});
