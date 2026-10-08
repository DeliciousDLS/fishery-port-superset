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
import { getTimeFormatterRegistry } from '@superset-ui/core';
import { configure } from '@apache-superset/core/translation';
import { SupersetTheme } from '@apache-superset/core/theme';
import Calendar from '../src/Calendar';
import {
  convertUTCTimestampToLocal,
  createCalendarDomainLabelFormatter,
  getFormattedUTCTime,
} from '../src/utils';

const mockInit = jest.fn();
jest.mock('../src/vendor/cal-heatmap', () =>
  jest.fn().mockImplementation(() => ({ init: mockInit })),
);

function setChineseLocale(locale: 'zh' | 'zh_TW') {
  getTimeFormatterRegistry()
    .clear()
    .setD3Format({
      days: [
        '星期日',
        '星期一',
        '星期二',
        '星期三',
        '星期四',
        '星期五',
        '星期六',
      ],
      shortDays: ['日', '一', '二', '三', '四', '五', '六'],
      months: Array.from({ length: 12 }, (_, index) => `${index + 1}月`),
      shortMonths: Array.from({ length: 12 }, (_, index) => `${index + 1}月`),
    });
  configure({
    languagePack: {
      domain: 'superset',
      locale_data: {
        superset: {
          '': {
            domain: 'superset',
            lang: locale,
            plural_forms: 'nplurals=1; plural=0;',
          },
          '%H:00': [locale === 'zh' ? '%H时' : '%H時'],
          '%e %b': ['%-m月%-d日'],
          '%B Week #%W': [locale === 'zh' ? '%B 第%W周' : '%B 第%W週'],
          '%Y': ['%Y年'],
        },
      },
    },
  });
}

afterEach(() => {
  getTimeFormatterRegistry().clear().setD3Format({});
  configure();
  mockInit.mockClear();
});

test.each(['zh', 'zh_TW'] as const)(
  'calendar headings use %s dates for every visible granularity',
  locale => {
    setChineseLocale(locale);
    const date = new Date(2026, 7, 1, 8);
    expect(createCalendarDomainLabelFormatter('month')(date)).toBe('8月');
    expect(createCalendarDomainLabelFormatter('day')(date)).toBe('8月1日');
    expect(createCalendarDomainLabelFormatter('hour')(date)).toBe(
      locale === 'zh' ? '08时' : '08時',
    );
    expect(createCalendarDomainLabelFormatter('week')(date)).toBe(
      locale === 'zh' ? '8月 第30周' : '8月 第30週',
    );
    expect(createCalendarDomainLabelFormatter('year')(date)).toBe('2026年');
    expect(createCalendarDomainLabelFormatter('min')(date)).toBe('');
  },
);

test('calendar preserves English labels after switching back from Chinese', () => {
  setChineseLocale('zh');
  const date = new Date(2026, 7, 1, 8);
  expect(createCalendarDomainLabelFormatter('month')(date)).toBe('8月');
  getTimeFormatterRegistry().clear().setD3Format({});
  configure();
  expect(createCalendarDomainLabelFormatter('month')(date)).toBe('August');
  expect(createCalendarDomainLabelFormatter('day')(date)).toBe(' 1 Aug');
  expect(createCalendarDomainLabelFormatter('week')(date)).toBe(
    'August Week #30',
  );
  expect(createCalendarDomainLabelFormatter('hour')(date)).toBe('08:00');
  expect(createCalendarDomainLabelFormatter('year')(date)).toBe('2026');
});

test.each([
  [Date.UTC(2026, 7, 1), '2026-08-01 星期六 8月'],
  [Date.UTC(2026, 8, 1), '2026-09-01 星期二 9月'],
  [Date.UTC(2027, 0, 1), '2027-01-01 星期五 1月'],
])(
  'localized tooltip preserves the UTC day at month/year boundary %i',
  (timestamp, expected) => {
    setChineseLocale('zh');
    expect(
      getFormattedUTCTime(
        convertUTCTimestampToLocal(timestamp),
        '%Y-%m-%d %A %B',
      ),
    ).toBe(expected);
  },
);

test('calendar supplies locale-aware headings and the selected tooltip format to the vendor', () => {
  setChineseLocale('zh');
  const timestamp = Date.UTC(2026, 8, 1);
  const element = document.createElement('div');
  Calendar(element, {
    data: {
      data: { revenue: { [timestamp / 1000]: 100 } },
      domain: 'month',
      subdomain: 'day',
      start: timestamp,
      range: 1,
    },
    height: 200,
    domainGranularity: 'month',
    subdomainGranularity: 'day',
    linearColorScheme: 'schemeBlues',
    showLegend: true,
    showMetricName: false,
    showValues: false,
    steps: 5,
    timeFormatter: ts => getFormattedUTCTime(ts, '%Y-%m-%d %A %B'),
    valueFormatter: value => String(value),
    verboseMap: { revenue: '收入' },
    theme: { colorBgElevated: '#fff' } as SupersetTheme,
  });
  const [[options]] = mockInit.mock.calls;
  const date = new Date(convertUTCTimestampToLocal(timestamp));
  expect(options.domainLabelFormat(date)).toBe('9月');
  expect(options.subDomainDateFormat(date)).toBe('2026-09-01 星期二 9月');
  expect(options.subDomainTitleFormat).toEqual({
    empty: '{date}',
    filled: '{date}: {count}',
  });
});
