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
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import {
  clearPermissionSearchCache,
  fetchGroupOptions,
  fetchPermissionOptions,
} from './utils';

const getMock = jest.spyOn(SupersetClient, 'get');
type Permission = {
  id: number;
  permission: { name: string };
  view_menu: { name: string };
};
const resultFor = (result: Permission[], count = result.length) =>
  ({ json: { count, result } }) as Awaited<
    ReturnType<typeof SupersetClient.get>
  >;
const permissions: Permission[] = [
  { id: 5, permission: { name: 'can_read' }, view_menu: { name: 'ChartView' } },
  {
    id: 6,
    permission: { name: 'can_write' },
    view_menu: { name: 'ChartView' },
  },
  {
    id: 7,
    permission: { name: 'can_read' },
    view_menu: { name: 'DashboardView' },
  },
];

afterEach(() => {
  getMock.mockReset();
  clearPermissionSearchCache();
});

test('permission search avoids unsupported nested API filters and matches resource labels', async () => {
  getMock.mockImplementation(({ endpoint }) => {
    const query = rison.decode(endpoint.split('?q=')[1]) as Record<
      string,
      unknown
    >;
    if (query.filters)
      return Promise.reject(new Error('Filter column not allowed'));
    return Promise.resolve(resultFor(permissions));
  });
  const addDangerToast = jest.fn();
  const result = await fetchPermissionOptions('chart', 0, 50, addDangerToast);
  expect(getMock).toHaveBeenCalledTimes(1);
  expect(result).toEqual({
    data: [
      { value: 5, label: 'can read ChartView' },
      { value: 6, label: 'can write ChartView' },
    ],
    totalCount: 2,
  });
  expect(addDangerToast).not.toHaveBeenCalled();
});

test('permission search matches permission names including underscores and case', async () => {
  getMock.mockResolvedValue(resultFor(permissions));
  const result = await fetchPermissionOptions(' CAN_READ ', 0, 50, jest.fn());
  expect(result.data.map(item => item.value)).toEqual([5, 7]);
  expect(result.totalCount).toBe(2);
});

test('permission search filters before applying client-side pagination', async () => {
  getMock.mockResolvedValue(resultFor(permissions));
  await fetchPermissionOptions('can', 0, 2, jest.fn());
  getMock.mockClear();
  const result = await fetchPermissionOptions('can', 1, 2, jest.fn());
  expect(getMock).not.toHaveBeenCalled();
  expect(result).toEqual({
    data: [{ value: 7, label: 'can read DashboardView' }],
    totalCount: 3,
  });
});

test('empty permission search uses normal server pagination', async () => {
  getMock.mockResolvedValue(resultFor([]));
  await fetchPermissionOptions('', 1, 25, jest.fn());
  expect(
    rison.decode(getMock.mock.calls[0][0].endpoint.split('?q=')[1]),
  ).toEqual({ page: 1, page_size: 25 });
});

test('permission search reports one error and does not cache a failed request', async () => {
  getMock.mockRejectedValueOnce(new Error('request failed'));
  const addDangerToast = jest.fn();
  expect(await fetchPermissionOptions('chart', 0, 100, addDangerToast)).toEqual(
    { data: [], totalCount: 0 },
  );
  expect(addDangerToast).toHaveBeenCalledTimes(1);
  getMock.mockResolvedValue(resultFor(permissions));
  expect(
    (await fetchPermissionOptions('chart', 0, 100, addDangerToast)).totalCount,
  ).toBe(2);
});

test('permission search follows the backend page cap and finds names on later pages', async () => {
  getMock.mockImplementation(({ endpoint }) => {
    const query = rison.decode(endpoint.split('?q=')[1]) as {
      page: number;
      page_size: number;
    };
    const pages = [[permissions[0]], [permissions[1]], [permissions[2]]];
    return Promise.resolve(resultFor(pages[query.page], 3));
  });
  const result = await fetchPermissionOptions('Dashboard', 0, 50, jest.fn());
  expect(getMock).toHaveBeenCalledTimes(3);
  expect(result).toEqual({
    data: [{ value: 7, label: 'can read DashboardView' }],
    totalCount: 1,
  });
});

test('permission search shares normalized cache keys and preserves cache across empty searches', async () => {
  getMock.mockResolvedValue(resultFor(permissions));
  await fetchPermissionOptions(' CAN_READ ', 0, 50, jest.fn());
  await fetchPermissionOptions('', 0, 50, jest.fn());
  getMock.mockClear();
  expect(
    (await fetchPermissionOptions('can read', 0, 50, jest.fn())).totalCount,
  ).toBe(2);
  expect(getMock).not.toHaveBeenCalled();
});

test('permission search evicts the oldest cache entry', async () => {
  getMock.mockResolvedValue(resultFor(permissions));
  for (let i = 0; i < 21; i += 1)
    await fetchPermissionOptions(`term${i}`, 0, 50, jest.fn());
  getMock.mockClear();
  await fetchPermissionOptions('term0', 0, 50, jest.fn());
  expect(getMock).toHaveBeenCalledTimes(1);
  getMock.mockClear();
  await fetchPermissionOptions('term2', 0, 50, jest.fn());
  expect(getMock).not.toHaveBeenCalled();
});

test('permission search bounds concurrent page requests', async () => {
  let inFlight = 0;
  let maxConcurrent = 0;
  getMock.mockImplementation(({ endpoint }) => {
    const { page } = rison.decode(endpoint.split('?q=')[1]) as { page: number };
    inFlight += 1;
    maxConcurrent = Math.max(maxConcurrent, inFlight);
    return new Promise(resolve => {
      setTimeout(() => {
        inFlight -= 1;
        resolve(
          resultFor(
            [
              {
                id: page + 1,
                permission: { name: 'can_read' },
                view_menu: { name: `Chart${page}` },
              },
            ],
            8,
          ),
        );
      }, 0);
    });
  });
  const result = await fetchPermissionOptions('Chart', 0, 50, jest.fn());
  expect(result.totalCount).toBe(8);
  expect(maxConcurrent).toBeLessThanOrEqual(3);
});

test('group search uses its supported name filter', async () => {
  getMock.mockResolvedValue({
    json: { count: 1, result: [{ id: 1, name: 'Engineering' }] },
  } as Awaited<ReturnType<typeof SupersetClient.get>>);
  const result = await fetchGroupOptions('eng', 1, 25, jest.fn());
  expect(
    rison.decode(getMock.mock.calls[0][0].endpoint.split('?q=')[1]),
  ).toEqual({
    page: 1,
    page_size: 25,
    filters: [{ col: 'name', opr: 'ct', value: 'eng' }],
  });
  expect(result).toEqual({
    data: [{ value: 1, label: 'Engineering' }],
    totalCount: 1,
  });
});

test('group search omits filters when empty', async () => {
  getMock.mockResolvedValue(resultFor([]));
  await fetchGroupOptions('', 0, 100, jest.fn());
  expect(
    rison.decode(getMock.mock.calls[0][0].endpoint.split('?q=')[1]),
  ).toEqual({ page: 0, page_size: 100 });
});

test('group search reports errors', async () => {
  getMock.mockRejectedValue(new Error('request failed'));
  const addDangerToast = jest.fn();
  expect(await fetchGroupOptions('eng', 0, 100, addDangerToast)).toEqual({
    data: [],
    totalCount: 0,
  });
  expect(addDangerToast).toHaveBeenCalledWith(
    'There was an error while fetching groups',
  );
});
