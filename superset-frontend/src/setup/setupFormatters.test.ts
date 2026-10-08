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
import { getTimeFormatter, getTimeFormatterRegistry } from '@superset-ui/core';
import setupFormatters from './setupFormatters';

const augustDate = Date.UTC(2026, 7, 11, 14, 30, 0);

afterEach(() => setupFormatters({}, {}, 'en'));

test.each(['zh', 'zh-cn', 'zh_TW', 'zh-hk'])(
  'chart dates use Chinese month, weekday and period names for %s',
  locale => {
    setupFormatters({}, {}, locale);
    expect(getTimeFormatter('%B %A %p')(augustDate)).toBe('8月 星期二 下午');
    expect(getTimeFormatter('%b')(augustDate)).toBe('8月');
    expect(getTimeFormatter('%x')(augustDate)).toBe('2026年8月11日');
  },
);

test('switching from Chinese to English regenerates cached formatters', () => {
  setupFormatters({}, {}, 'zh');
  expect(getTimeFormatter('%B')(augustDate)).toBe('8月');
  setupFormatters({}, {}, 'en');
  expect(getTimeFormatter('%B %A %p')(augustDate)).toBe('August Tuesday PM');
  expect(getTimeFormatter('%B')(augustDate)).toBe('August');
});

test('explicit server date names take precedence over locale defaults', () => {
  const months = Array.from({ length: 12 }, (_, index) => `会计月${index + 1}`);
  setupFormatters({}, { months }, 'zh');
  expect(getTimeFormatter('%B')(augustDate)).toBe('会计月8');
  expect(getTimeFormatter('%A')(augustDate)).toBe('星期二');
});

test('date localization preserves UTC boundaries and ISO date formats', () => {
  setupFormatters({}, {}, 'zh');
  expect(getTimeFormatter('%Y-%m-%d')(Date.UTC(2026, 0, 1))).toBe('2026-01-01');
  expect(getTimeFormatter('%B')(Date.UTC(2025, 11, 31, 23, 59))).toBe('12月');
  expect(getTimeFormatter('%B')(Date.UTC(2026, 0, 1))).toBe('1月');
  expect(getTimeFormatterRegistry().d3Format.time).toBe('%H:%M:%S');
});
