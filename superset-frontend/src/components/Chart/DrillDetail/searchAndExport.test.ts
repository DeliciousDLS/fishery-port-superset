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
  BinaryQueryObjectFilterClause,
  QueryFormData,
  SupersetClient,
  VizType,
} from '@superset-ui/core';
import {
  buildDrillExportPayload,
  buildSearchFilter,
  exportDrillDetail,
} from './searchAndExport';

const formData: QueryFormData = {
  datasource: '42__table',
  viz_type: VizType.Table,
};

/** Supply the Blob API missing from the JSDOM version used by these tests. */
function mockBlobPrefix(blob: Blob, bytes: number[]) {
  return jest.spyOn(blob, 'slice').mockReturnValue({
    arrayBuffer: jest.fn().mockResolvedValue(Uint8Array.from(bytes).buffer),
  } as unknown as Blob);
}

afterEach(() => {
  jest.restoreAllMocks();
});

test('creates a case-insensitive substring search after trimming whitespace', () => {
  expect(buildSearchFilter('license_plate', '  闽A12345  ')).toEqual({
    col: 'license_plate',
    op: 'ILIKE',
    val: '%闽A12345%',
  });
});

test('treats LIKE wildcards and backslashes as literal search text', () => {
  expect(buildSearchFilter('name', String.raw`50%_\value`)).toEqual({
    col: 'name',
    op: 'ILIKE',
    val: String.raw`%50\%\_\\value%`,
  });
  expect(buildSearchFilter('name', "x' OR 1=1 --")).toEqual({
    col: 'name',
    op: 'ILIKE',
    val: "%x' OR 1=1 --%",
  });
});

test('omits search when the text or selected column is empty', () => {
  expect(buildSearchFilter('name', ' \n\t ')).toBeUndefined();
  expect(buildSearchFilter('', 'value')).toBeUndefined();
});

test.each(['csv', 'xlsx'] as const)(
  'exports %s detail rows from the first row with the supplied filters and time range',
  format => {
    const chartFormData: QueryFormData = {
      ...formData,
      slice_id: 99,
      metrics: ['count'],
      groupby: ['zone'],
      row_limit: 50,
      row_offset: 100,
      granularity_sqla: 'entry_time',
      time_range: 'Last week',
      extra_filters: [{ col: 'status', op: '==', val: 'parked' }],
      extra_form_data: {
        filters: [{ col: 'port', op: '==', val: 'north' }],
        time_range: '2026-10-01 : 2026-10-14',
      },
      adhoc_filters: [
        {
          expressionType: 'SQL',
          clause: 'HAVING',
          sqlExpression: 'COUNT(*) > 5',
        },
      ],
    };
    const search = buildSearchFilter('license_plate', '123')!;
    const payload = buildDrillExportPayload(
      chartFormData,
      [{ col: 'zone', op: '==', val: 'A', formattedVal: 'Zone A' }, search],
      format,
      10000,
      7,
    );

    expect(payload).toEqual({
      datasource: { id: 42, type: 'table' },
      force: true,
      result_type: 'drill_detail',
      result_format: format,
      form_data: { dashboardId: 7 },
      queries: [
        {
          granularity: 'entry_time',
          time_range: '2026-10-01 : 2026-10-14',
          filters: [
            { col: 'status', op: '==', val: 'parked' },
            { col: 'port', op: '==', val: 'north' },
            { col: 'zone', op: '==', val: 'A' },
            search,
          ],
          extras: expect.not.objectContaining({ having: expect.anything() }),
          row_limit: 10000,
          row_offset: 0,
        },
      ],
    });
    expect(payload.queries[0]).not.toHaveProperty('metrics');
    expect(payload.queries[0]).not.toHaveProperty('columns');
    expect(payload.form_data).not.toHaveProperty('slice_id');
    expect(chartFormData.row_offset).toBe(100);
  },
);

test('resolves Chinese display names in native, drill, and search filters for export', () => {
  const drillFilter: BinaryQueryObjectFilterClause = {
    col: '停车区域',
    op: '==',
    val: 'A',
  };
  const search = buildSearchFilter('车牌号', '闽A')!;
  const payload = buildDrillExportPayload(
    {
      ...formData,
      extra_form_data: {
        filters: [{ col: '港区', op: '==', val: '北港' }],
      },
    },
    [drillFilter, search],
    'csv',
    1000,
    7,
    [
      { column_name: 'port', verbose_name: '港区' },
      { column_name: 'zone', verbose_name: '停车区域' },
      { column_name: 'license_plate', verbose_name: '车牌号' },
    ],
  );

  expect(payload.queries[0].filters).toEqual([
    { col: 'port', op: '==', val: '北港' },
    { col: 'zone', op: '==', val: 'A' },
    { col: 'license_plate', op: 'ILIKE', val: '%闽A%' },
  ]);
  expect(drillFilter.col).toBe('停车区域');
  expect(search.col).toBe('车牌号');
});

test('prefers a physical column when another column has the same display name', () => {
  const filter: BinaryQueryObjectFilterClause = {
    col: '车牌号',
    op: '==',
    val: '闽A12345',
  };
  const payload = buildDrillExportPayload(formData, [filter], 'xlsx', 1000, 7, [
    { column_name: 'previous_plate', verbose_name: '车牌号' },
    { column_name: '车牌号', verbose_name: '当前车牌' },
  ]);

  expect(payload.queries[0].filters).toEqual([filter]);
});

test('preserves unknown names and expression columns when resolving export filters', () => {
  const filters: BinaryQueryObjectFilterClause[] = [
    { col: '车牌', op: '==', val: '12345' },
    {
      col: {
        expressionType: 'SQL',
        sqlExpression: 'LOWER(plate)',
        label: '车牌号',
      },
      op: '==',
      val: '12345',
    },
  ];
  const payload = buildDrillExportPayload(
    formData,
    filters,
    'csv',
    1000,
    undefined,
    [{ column_name: 'plate', verbose_name: '车牌号' }],
  );

  expect(payload.queries[0].filters).toEqual(filters);
});

test.each([
  ['csv', 'parking-detail', 'parking-detail.csv'],
  ['xlsx', 'parking-detail.xlsx', 'parking-detail.xlsx'],
] as const)(
  'downloads %s from the chart data endpoint and releases the object URL',
  async (format, filename, expectedFilename) => {
    const payload = buildDrillExportPayload(formData, [], format, 1000, 7);
    const blob = new Blob(['\uFEFFdetail rows']);
    const readPrefix = mockBlobPrefix(blob, [0xef, 0xbb, 0xbf]);
    const post = jest.spyOn(SupersetClient, 'post').mockResolvedValue({
      blob: jest.fn().mockResolvedValue(blob),
    } as unknown as Response);
    const anchor = document.createElement('a');
    const click = jest.spyOn(anchor, 'click').mockImplementation(() => {});
    jest.spyOn(document, 'createElement').mockReturnValue(anchor);
    jest.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:detail');
    window.URL.revokeObjectURL ??= jest.fn();
    const revoke = jest.spyOn(window.URL, 'revokeObjectURL');

    await exportDrillDetail(payload, filename);

    expect(post).toHaveBeenCalledWith({
      endpoint: '/api/v1/chart/data',
      jsonPayload: payload,
      parseMethod: 'raw',
    });
    expect(anchor.download).toBe(expectedFilename);
    expect(click).toHaveBeenCalledTimes(1);
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(blob);
    if (format === 'csv') {
      expect(readPrefix).toHaveBeenCalledWith(0, 3);
    } else {
      expect(readPrefix).not.toHaveBeenCalled();
    }
    expect(anchor.parentElement).toBeNull();
    expect(revoke).toHaveBeenCalledWith('blob:detail');
  },
);

test('prepends a UTF-8 BOM to CSV exports that do not already contain one', async () => {
  const blob = new Blob(['车牌号,港区\n闽A12345,北港'], { type: 'text/csv' });
  mockBlobPrefix(blob, [0xe8, 0xbd, 0xa6]);
  jest.spyOn(SupersetClient, 'post').mockResolvedValue({
    blob: jest.fn().mockResolvedValue(blob),
  } as unknown as Response);
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const createUrl = jest
    .spyOn(window.URL, 'createObjectURL')
    .mockReturnValue('blob:detail');
  window.URL.revokeObjectURL ??= jest.fn();
  jest.spyOn(window.URL, 'revokeObjectURL');

  await exportDrillDetail(
    buildDrillExportPayload(formData, [], 'csv', 1000),
    'detail',
  );

  const downloadedBlob = createUrl.mock.calls[0][0] as Blob;
  expect(downloadedBlob.size).toBe(blob.size + 3);
  expect(downloadedBlob.type).toBe('text/csv');
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(downloadedBlob);
  });
  expect(Array.from(new Uint8Array(bytes).slice(0, 3))).toEqual([
    0xef, 0xbb, 0xbf,
  ]);
});

test('propagates backend permission failures without creating a download', async () => {
  const error = new Error('Forbidden');
  jest.spyOn(SupersetClient, 'post').mockRejectedValue(error);
  const createUrl = jest.spyOn(window.URL, 'createObjectURL');

  await expect(
    exportDrillDetail(
      buildDrillExportPayload(formData, [], 'csv', 1000),
      'detail',
    ),
  ).rejects.toBe(error);
  expect(createUrl).not.toHaveBeenCalled();
});

test('removes the anchor and releases the object URL if downloading fails', async () => {
  const blob = new Blob(['\uFEFFdetail rows']);
  mockBlobPrefix(blob, [0xef, 0xbb, 0xbf]);
  jest.spyOn(SupersetClient, 'post').mockResolvedValue({
    blob: jest.fn().mockResolvedValue(blob),
  } as unknown as Response);
  const anchor = document.createElement('a');
  const error = new Error('Download unavailable');
  jest.spyOn(anchor, 'click').mockImplementation(() => {
    throw error;
  });
  jest.spyOn(document, 'createElement').mockReturnValue(anchor);
  jest.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:detail');
  window.URL.revokeObjectURL ??= jest.fn();
  const revoke = jest.spyOn(window.URL, 'revokeObjectURL');

  await expect(
    exportDrillDetail(
      buildDrillExportPayload(formData, [], 'csv', 1000),
      'detail',
    ),
  ).rejects.toBe(error);
  expect(anchor.parentElement).toBeNull();
  expect(revoke).toHaveBeenCalledWith('blob:detail');
});
