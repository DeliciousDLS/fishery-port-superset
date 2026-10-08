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
import { TimeLocaleDefinition } from 'd3-time-format';

/** Supply Chinese dates for charts while preserving explicit server overrides. */
export default function getDateLocale(
  locale: string,
  overrides: Partial<TimeLocaleDefinition>,
): Partial<TimeLocaleDefinition> {
  if (!/^zh(?:[-_]|$)/i.test(locale)) return overrides;

  const months = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);
  return {
    dateTime: '%x %A %X',
    date: '%Y年%-m月%-d日',
    time: '%H:%M:%S',
    periods: ['上午', '下午'],
    days: [
      '星期日',
      '星期一',
      '星期二',
      '星期三',
      '星期四',
      '星期五',
      '星期六',
    ],
    shortDays: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    months,
    shortMonths: months,
    ...overrides,
  };
}
