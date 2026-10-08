/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  configure,
  t,
  tn,
  LanguagePack,
} from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import setupLanguage from './setupLanguage';

jest.mock('../utils/pathUtils', () => ({ makeUrl: (url: string) => url }));

const languagePack: LanguagePack = {
  domain: 'superset',
  locale_data: {
    superset: {
      '': {
        domain: 'superset',
        lang: 'zh',
        plural_forms: 'nplurals=1; plural=0;',
      },
      Apply: ['应用'],
      '%s option': ['%s 个选项'],
    },
  },
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  configure();
});

test('bootstrap translations are ready synchronously before module evaluation', async () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  const ready = setupLanguage('zh', languagePack);
  expect(t('Apply')).toBe('应用');
  expect(dayjs.locale()).toBe('zh-cn');
  expect(fetchMock).not.toHaveBeenCalled();
  await ready;
});

test.each([0, 1, 3, 4, 168])(
  'Chinese options preserve a dynamic count of %s',
  async count => {
    await setupLanguage('zh', languagePack);
    expect(tn('%s option', '%s options', count, count)).toBe(`${count} 个选项`);
  },
);

test('ordinary pages fetch the language pack when bootstrap has none', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => languagePack,
  } as Response);
  await setupLanguage('zh');
  expect(fetchMock).toHaveBeenCalledWith(
    '/superset/language_pack/zh/',
    expect.objectContaining({
      cache: 'no-cache',
      signal: expect.any(AbortSignal),
    }),
  );
  expect(t('Apply')).toBe('应用');
});

test('ordinary pages revalidate a previously cached language pack after deployment', async () => {
  const stalePack: LanguagePack = {
    ...languagePack,
    locale_data: {
      superset: {
        ...languagePack.locale_data.superset,
        'Sankey Chart': ['图表保存'],
      },
    },
  };
  const updatedPack: LanguagePack = {
    ...languagePack,
    locale_data: {
      superset: {
        ...languagePack.locale_data.superset,
        'Sankey Chart': ['桑基图'],
      },
    },
  };
  configure({ languagePack: stalePack });
  expect(t('Sankey Chart')).toBe('图表保存');
  const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(
    async (_url, options) =>
      ({
        ok: true,
        json: async () =>
          options?.cache === 'no-cache' ? updatedPack : stalePack,
      }) as Response,
  );

  await setupLanguage('zh');

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(t('Sankey Chart')).toBe('桑基图');
  expect(dayjs.locale()).toBe('zh-cn');
});

test('a bootstrap pack for a different locale does not override the requested language', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => languagePack,
  } as Response);
  const wrongPack = {
    ...languagePack,
    locale_data: {
      superset: {
        ...languagePack.locale_data.superset,
        '': { ...languagePack.locale_data.superset[''], lang: 'en' as const },
      },
    },
  };
  await setupLanguage('zh', wrongPack);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(t('Apply')).toBe('应用');
});

test('failed language requests fall back to English without blocking startup', async () => {
  jest.spyOn(logging, 'warn').mockImplementation(() => {});
  jest
    .spyOn(global, 'fetch')
    .mockResolvedValue({ ok: false, status: 403 } as Response);
  await setupLanguage('zh');
  expect(t('Apply')).toBe('Apply');
  expect(dayjs.locale()).toBe('en');
});

test('English initialization clears a previously selected translation without a request', async () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  await setupLanguage('zh', languagePack);
  await setupLanguage('en', languagePack);
  expect(t('Apply')).toBe('Apply');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('traditional Chinese initializes the date library with its matching locale', async () => {
  const traditionalPack = {
    ...languagePack,
    locale_data: {
      superset: {
        ...languagePack.locale_data.superset,
        '': { ...languagePack.locale_data.superset[''], lang: 'zh_TW' },
      },
    },
  } as LanguagePack;
  await setupLanguage('zh_TW', traditionalPack);
  expect(dayjs.locale()).toBe('zh-tw');
});

test('a stalled language request is aborted after five seconds', async () => {
  jest.useFakeTimers();
  jest.spyOn(logging, 'warn').mockImplementation(() => {});
  jest.spyOn(global, 'fetch').mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () =>
          reject(new Error('aborted')),
        );
      }),
  );
  const ready = setupLanguage('zh');
  jest.advanceTimersByTime(5000);
  await ready;
  expect(t('Apply')).toBe('Apply');
});
