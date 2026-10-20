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
import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import {
  BinaryQueryObjectFilterClause,
  QueryFormData,
  SupersetClient,
} from '@superset-ui/core';
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
import { getMockStoreWithNativeFilters } from 'spec/fixtures/mockStore';
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import { supersetGetCache } from 'src/utils/cachedSupersetGet';
import * as permissions from 'src/utils/findPermission';
import DrillDetailPane from './DrillDetailPane';
import { exportDrillDetail } from './searchAndExport';

jest.mock('./searchAndExport', () => ({
  ...jest.requireActual('./searchAndExport'),
  exportDrillDetail: jest.fn().mockResolvedValue(undefined),
}));

const chart = chartQueries[sliceId];
type PaneProps = ComponentProps<typeof DrillDetailPane>;

const setup = (overrides: Partial<PaneProps> = {}) => {
  const store = getMockStoreWithNativeFilters();
  const props = {
    initialFilters: [],
    formData: chart.form_data as unknown as QueryFormData,
    ...overrides,
  };
  return {
    ...render(<DrillDetailPane {...props} />, {
      useRedux: true,
      store,
    }),
    store,
  };
};

const waitForRender = (overrides: Partial<PaneProps> = {}) =>
  waitFor(() => setup(overrides));

const SAMPLES_ENDPOINT =
  'end:/datasource/samples?force=false&datasource_type=table&datasource_id=7&per_page=50&page=1';

const DATASET_ENDPOINT = 'glob:*/api/v1/dataset/*';

const MOCKED_DATASET = {
  changed_on_humanized: '2 days ago',
  created_on_humanized: 'a week ago',
  description: 'Simple description',
  table_name: 'test_table',
  changed_by: {
    first_name: 'John',
    last_name: 'Doe',
  },
  created_by: {
    first_name: 'John',
    last_name: 'Doe',
  },
  owners: [
    {
      first_name: 'John',
      last_name: 'Doe',
    },
  ],
};

const setupDatasetEndpoint = () => {
  fetchMock.get(DATASET_ENDPOINT, {
    status: 'complete',
    result: MOCKED_DATASET,
  });
};

const fetchWithNoData = () => {
  setupDatasetEndpoint();
  fetchMock.post(SAMPLES_ENDPOINT, {
    result: {
      total_count: 0,
      data: [],
      colnames: [],
      coltypes: [],
    },
  });
};

const fetchWithData = () => {
  setupDatasetEndpoint();
  fetchMock.post(SAMPLES_ENDPOINT, {
    result: {
      total_count: 3,
      data: [
        {
          year: 1996,
          na_sales: 11.27,
          eu_sales: 8.89,
        },
        {
          year: 1989,
          na_sales: 23.2,
          eu_sales: 2.26,
        },
        {
          year: 1999,
          na_sales: 9,
          eu_sales: 6.18,
        },
      ],
      colnames: ['year', 'na_sales', 'eu_sales'],
      coltypes: [0, 0, 0],
    },
  });
};

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  supersetGetCache.clear();
  jest.restoreAllMocks();
  jest.mocked(exportDrillDetail).mockClear();
});

test('should render', async () => {
  fetchWithNoData();
  const { container } = await waitForRender();
  expect(container).toBeInTheDocument();
});

test('should render loading indicator', async () => {
  fetchWithData();
  setup();
  await waitFor(() =>
    expect(screen.getByLabelText('Loading')).toBeInTheDocument(),
  );
});

test('should render the table with results', async () => {
  fetchWithData();
  await waitForRender();
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getByText('1996')).toBeInTheDocument();
  expect(screen.getByText('11.27')).toBeInTheDocument();
  expect(screen.getByText('1989')).toBeInTheDocument();
  expect(screen.getByText('23.2')).toBeInTheDocument();
  expect(screen.getByText('1999')).toBeInTheDocument();
  expect(screen.getByText('9')).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: 'year' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: 'na_sales' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: 'eu_sales' }),
  ).toBeInTheDocument();
});

test('should render the "No results" components', async () => {
  fetchWithNoData();
  setup();
  expect(
    await screen.findByText('No rows were returned for this dataset'),
  ).toBeInTheDocument();
});

test('should render the metadata bar', async () => {
  fetchWithNoData();
  setup({ dataset: MOCKED_DATASET });
  expect(
    await screen.findByText(MOCKED_DATASET.table_name),
  ).toBeInTheDocument();
  expect(
    await screen.findByText(MOCKED_DATASET.description),
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      `${MOCKED_DATASET.created_by.first_name} ${MOCKED_DATASET.created_by.last_name}`,
    ),
  ).toBeInTheDocument();
  expect(
    await screen.findByText(MOCKED_DATASET.changed_on_humanized),
  ).toBeInTheDocument();
});

test('should render the error', async () => {
  jest
    .spyOn(SupersetClient, 'post')
    .mockRejectedValue(new Error('Something went wrong'));
  await waitForRender();
  expect(screen.getByText('Error: Something went wrong')).toBeInTheDocument();
});

test('should use verbose_map for column headers when available', async () => {
  jest.restoreAllMocks();

  const datasetWithVerboseMap = {
    ...MOCKED_DATASET,
    verbose_map: {
      year: 'Year of Release',
      na_sales: 'North America Sales',
    },
  };

  fetchMock.post(SAMPLES_ENDPOINT, {
    result: {
      total_count: 1,
      data: [
        {
          year: 1996,
          na_sales: 11.27,
          eu_sales: 8.89,
        },
      ],
      colnames: ['year', 'na_sales', 'eu_sales'],
      coltypes: [0, 0, 0],
    },
  });

  await waitForRender({ dataset: datasetWithVerboseMap });

  expect(
    screen.getByRole('columnheader', { name: 'Year of Release' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: 'North America Sales' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('columnheader', { name: 'eu_sales' }),
  ).toBeInTheDocument();

  expect(
    screen.queryByRole('columnheader', { name: 'year' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('columnheader', { name: 'na_sales' }),
  ).not.toBeInTheDocument();
});

test('changing page size resets the cache and requests consecutive pages at that size', async () => {
  jest.restoreAllMocks();
  setupDatasetEndpoint();
  const requestedPages: { size: number; page: number }[] = [];
  fetchMock.post(/\/datasource\/samples\?/, ({ url }) => {
    const params = new URL(url, 'http://localhost').searchParams;
    const size = Number(params.get('per_page'));
    const page = Number(params.get('page'));
    requestedPages.push({ size, page });
    return {
      result: {
        total_count: 150,
        data: Array.from(
          { length: Math.min(size, 150 - (page - 1) * size) },
          (_, index) => ({
            entry: `record-${(page - 1) * size + index + 1}`,
          }),
        ),
        colnames: ['entry'],
        coltypes: [1],
      },
    };
  });
  setup();
  await waitFor(() => expect(screen.getByText('record-1')).toBeInTheDocument());
  await userEvent.click(screen.getByTitle('2'));
  await waitFor(() =>
    expect(screen.getByText('record-51')).toBeInTheDocument(),
  );
  await userEvent.click(
    within(screen.getByTitle('2').parentElement!).getByRole('combobox'),
  );
  await userEvent.click(
    screen
      .getAllByText('100 / page')
      .find(element => element.closest('.ant-select-item-option-content'))!,
  );
  await waitFor(() => expect(screen.getByText('record-1')).toBeInTheDocument());
  expect(
    screen
      .getAllByText('100 / page')
      .find(element => element.closest('.ant-select-selection-item')),
  ).toBeVisible();
  expect(screen.getByTitle('1')).toHaveClass('ant-pagination-item-active');
  await userEvent.click(screen.getByTitle('2'));
  await waitFor(() =>
    expect(screen.getByText('record-101')).toBeInTheDocument(),
  );
  expect(requestedPages).toEqual([
    { size: 50, page: 1 },
    { size: 50, page: 2 },
    { size: 100, page: 1 },
    { size: 100, page: 2 },
  ]);
});

type SamplesQuery = {
  filters: BinaryQueryObjectFilterClause[];
  time_range?: string;
  granularity?: string;
};

const setupSearchableSamples = () => {
  setupDatasetEndpoint();
  const requests: { page: number; query: SamplesQuery }[] = [];
  fetchMock.post(/\/datasource\/samples\?/, ({ url, options }) => {
    const params = new URL(url, 'http://localhost').searchParams;
    const page = Number(params.get('page'));
    const pageSize = Number(params.get('per_page'));
    const query = JSON.parse(options.body as string) as SamplesQuery;
    requests.push({ page, query });
    const search = query.filters.find(filter => filter.op === 'ILIKE');
    const total = search?.val === '%missing%' ? 0 : search ? 60 : 150;
    return {
      result: {
        total_count: total,
        data: Array.from(
          {
            length: Math.min(
              pageSize,
              Math.max(0, total - (page - 1) * pageSize),
            ),
          },
          (_, index) => ({
            entry: `${search ? 'needle-record' : 'record'}-${(page - 1) * pageSize + index + 1}`,
            description: 'Vehicle visit',
          }),
        ),
        colnames: total ? ['entry', 'description'] : [],
        coltypes: total ? [1, 1] : [],
      },
    };
  });
  return requests;
};

const scopedFormData = {
  ...chart.form_data,
  granularity_sqla: 'entry_time',
  granularity: 'entry_time',
  time_range: '2026-10-01 : 2026-10-14',
  extra_form_data: {
    filters: [{ col: 'payment_status', op: '==', val: 'paid' }],
  },
} as unknown as QueryFormData;

const initialDrillFilters: BinaryQueryObjectFilterClause[] = [
  { col: 'port_name', op: '==', val: 'Harbour A' },
];

test('searches the server within the drill scope and restarts at page one without changing dashboard filters', async () => {
  const requests = setupSearchableSamples();
  const { store } = setup({
    formData: scopedFormData,
    initialFilters: initialDrillFilters,
  });
  const dashboardFilters = JSON.parse(
    JSON.stringify(store.getState().dataMask),
  );
  const nativeFilters = JSON.parse(
    JSON.stringify(store.getState().nativeFilters),
  );
  await screen.findByText('record-1');
  await userEvent.click(screen.getByTitle('2'));
  await screen.findByText('record-51');
  expect(screen.queryByText('needle-record-1')).not.toBeInTheDocument();

  await userEvent.type(
    screen.getByRole('searchbox', { name: 'Search detail records' }),
    'needle{enter}',
  );

  await screen.findByText('needle-record-1');
  expect(screen.getByTitle('1')).toHaveClass('ant-pagination-item-active');
  expect(requests.map(({ page }) => page)).toEqual([1, 2, 1]);
  expect(requests[2].query).toMatchObject({
    time_range: '2026-10-01 : 2026-10-14',
    granularity: 'entry_time',
    filters: expect.arrayContaining([
      { col: 'payment_status', op: '==', val: 'paid' },
      { col: 'port_name', op: '==', val: 'Harbour A' },
      { col: 'entry', op: 'ILIKE', val: '%needle%' },
    ]),
  });
  expect(store.getState().dataMask).toEqual(dashboardFilters);
  expect(store.getState().nativeFilters).toEqual(nativeFilters);
});

test('keeps search available after no matches and clears only the search condition', async () => {
  const requests = setupSearchableSamples();
  setup({ formData: scopedFormData, initialFilters: initialDrillFilters });
  await screen.findByText('record-1');
  const originalQuery = requests[0].query;

  await userEvent.type(
    screen.getByRole('searchbox', { name: 'Search detail records' }),
    'missing',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByText('No rows were returned for this dataset');
  expect(
    screen.getByRole('searchbox', { name: 'Search detail records' }),
  ).toHaveValue('missing');
  expect(screen.getByRole('combobox', { name: 'Search column' })).toBeEnabled();

  await userEvent.click(screen.getByRole('button', { name: 'close-circle' }));

  await screen.findByText('record-1');
  expect(
    screen.getByRole('searchbox', { name: 'Search detail records' }),
  ).toHaveValue('');
  expect(requests.map(({ page }) => page)).toEqual([1, 1, 1]);
  expect(requests[2].query).toEqual(originalQuery);
  expect(requests[2].query).toMatchObject({
    time_range: '2026-10-01 : 2026-10-14',
    filters: expect.arrayContaining([
      { col: 'payment_status', op: '==', val: 'paid' },
      { col: 'port_name', op: '==', val: 'Harbour A' },
    ]),
  });
});

test('changing the search column clears the text and applied search while keeping the drill scope', async () => {
  const requests = setupSearchableSamples();
  setup({ formData: scopedFormData, initialFilters: initialDrillFilters });
  await screen.findByText('record-1');
  const originalQuery = requests[0].query;
  await userEvent.type(
    screen.getByRole('searchbox', { name: 'Search detail records' }),
    'needle{enter}',
  );
  await screen.findByText('needle-record-1');
  expect(requests[1].query.filters).toContainEqual({
    col: 'entry',
    op: 'ILIKE',
    val: '%needle%',
  });

  await userEvent.click(
    screen.getByRole('combobox', { name: 'Search column' }),
  );
  await userEvent.click(
    screen
      .getAllByText('description')
      .find(element => element.closest('.ant-select-item-option-content'))!,
  );

  await screen.findByText('record-1');
  expect(
    screen.getByRole('searchbox', { name: 'Search detail records' }),
  ).toHaveValue('');
  expect(requests.map(({ page }) => page)).toEqual([1, 1, 1]);
  expect(requests[2].query).toEqual(originalQuery);
  expect(requests[2].query.filters.some(filter => filter.op === 'ILIKE')).toBe(
    false,
  );
});

test('exports all matching drill rows from the first row using the applied search and scope', async () => {
  jest.spyOn(permissions, 'findPermission').mockReturnValue(true);
  const requests = setupSearchableSamples();
  setup({ formData: scopedFormData, initialFilters: initialDrillFilters });
  await screen.findByText('record-1');
  await userEvent.type(
    screen.getByRole('searchbox', { name: 'Search detail records' }),
    'needle{enter}',
  );
  await screen.findByText('needle-record-1');
  await userEvent.click(screen.getByTitle('2'));
  await screen.findByText('needle-record-51');

  await userEvent.click(
    screen.getByRole('button', { name: 'Download as CSV' }),
  );

  await waitFor(() => expect(exportDrillDetail).toHaveBeenCalledTimes(1));
  const [payload, filename] = jest.mocked(exportDrillDetail).mock.calls[0];
  expect(payload.queries[0]).toMatchObject({
    ...requests[requests.length - 1].query,
    row_limit: 60,
    row_offset: 0,
  });
  expect(payload.form_data).not.toHaveProperty('slice_id');
  expect(payload).toMatchObject({
    datasource: { id: 7, type: 'table' },
    result_type: 'drill_detail',
    result_format: 'csv',
  });
  expect(filename).toBe('detail.csv');
  expect(scopedFormData.slice_id).toBe(sliceId);
});

test('does not expose exports when the user lacks download permission', async () => {
  jest.spyOn(permissions, 'findPermission').mockReturnValue(false);
  setupSearchableSamples();
  setup();
  await screen.findByText('record-1');

  expect(
    screen.queryByRole('button', { name: 'Download as CSV' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Download as Excel' }),
  ).not.toBeInTheDocument();
  expect(exportDrillDetail).not.toHaveBeenCalled();
});
