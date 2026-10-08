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
import { configure, LanguagePack } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import { makeUrl } from '../utils/pathUtils';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';
import 'dayjs/locale/zh-hk';

const LANGUAGE_PACK_REQUEST_TIMEOUT_MS = 5000;

/** Initialize translations before importing modules with translated constants. */
export default async function setupLanguage(
  locale = 'en',
  languagePack?: LanguagePack,
): Promise<void> {
  configure();
  dayjs.locale('en');
  if (locale === 'en') return;

  const dateLocale =
    locale === 'zh' ? 'zh-cn' : locale.replace('_', '-').toLowerCase();
  if (languagePack?.locale_data?.superset?.['']?.lang === locale) {
    configure({ languagePack });
    dayjs.locale(dateLocale);
    return;
  }

  // Embedded guests receive translations in bootstrap data; ordinary pages
  // retain the language-pack endpoint and its bounded English fallback.
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(
    () => abortController.abort(),
    LANGUAGE_PACK_REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch(
      makeUrl(`/superset/language_pack/${locale}/`),
      {
        cache: 'no-cache',
        signal: abortController.signal,
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch language pack: ${response.status}`);
    }
    configure({ languagePack: (await response.json()) as LanguagePack });
    dayjs.locale(dateLocale);
  } catch (error) {
    logging.warn(
      'Failed to fetch language pack, falling back to default.',
      error,
    );
    configure();
    dayjs.locale('en');
  } finally {
    window.clearTimeout(timeoutId);
  }
}
