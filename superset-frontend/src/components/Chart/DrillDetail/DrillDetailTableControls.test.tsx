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
  fireEvent,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import TableControls, { TableControlsProps } from './DrillDetailTableControls';

const setFilters = jest.fn();
const onReload = jest.fn();
const setup = (overrides: Partial<TableControlsProps> = {}) => {
  const props = {
    filters: [],
    setFilters,
    onReload,
    loading: false,
    totalCount: 0,
    ...overrides,
  };
  return render(<TableControls {...props} />);
};

const searchProps = {
  searchColumns: [
    { value: 'plate_number', label: 'Plate number' },
    { value: 'port_name', label: 'Port' },
  ],
  searchColumn: 'plate_number',
  searchText: 'PORT-001',
  onSearch: jest.fn(),
  onSearchTextChange: jest.fn(),
  onSearchColumnChange: jest.fn(),
  onClearSearch: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});
test('should render', () => {
  const { container } = setup();
  expect(container).toBeInTheDocument();
});

test('should show 0 rows', () => {
  setup();
  expect(screen.getByText('0 rows')).toBeInTheDocument();
});

test('should show the correct amount of rows', () => {
  setup({
    totalCount: 10,
  });
  expect(screen.getByText('10 rows')).toBeInTheDocument();
});

test('should render the reload button', () => {
  setup();
  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
});

test('should show the loading indicator', () => {
  setup({
    loading: true,
  });
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});

test('should call onreload', () => {
  setup();
  userEvent.click(screen.getByRole('button', { name: 'Reload' }));
  expect(onReload).toHaveBeenCalledTimes(1);
});

test('should render with filters', () => {
  setup({
    filters: [
      {
        col: 'platform',
        op: '==',
        val: 'GB',
      },
      {
        col: 'lang',
        op: '==',
        val: 'IT',
      },
    ],
  });
  expect(screen.getByText('platform')).toBeInTheDocument();
  expect(screen.getByText('GB')).toBeInTheDocument();
  expect(screen.getByText('lang')).toBeInTheDocument();
  expect(screen.getByText('IT')).toBeInTheDocument();
});

test('should remove the filters on close', () => {
  setup({
    filters: [
      {
        col: 'platform',
        op: '==',
        val: 'GB',
      },
    ],
  });
  expect(screen.getByText('platform')).toBeInTheDocument();
  expect(screen.getByText('GB')).toBeInTheDocument();

  userEvent.click(screen.getByLabelText('Close'));
  expect(setFilters).toHaveBeenCalledWith([]);
});

test('should submit detail searches by button and Enter', () => {
  setup(searchProps);

  userEvent.click(screen.getByRole('button', { name: 'Search' }));
  userEvent.type(
    screen.getByRole('searchbox', { name: 'Search detail records' }),
    '{enter}',
  );

  expect(searchProps.onSearch).toHaveBeenCalledTimes(2);
});

test('should pass the search text to its change handler', () => {
  setup(searchProps);

  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search detail records' }),
    {
      target: { value: 'PORT-002' },
    },
  );

  expect(searchProps.onSearchTextChange).toHaveBeenCalledWith('PORT-002');
  expect(searchProps.onSearch).not.toHaveBeenCalled();
});

test('should update the selected search column', async () => {
  setup(searchProps);

  userEvent.click(screen.getByRole('combobox', { name: 'Search column' }));
  userEvent.click(await screen.findByText('Port'));

  expect(searchProps.onSearchColumnChange).toHaveBeenCalledWith('port_name');
});

test('should clear the applied search when the input is cleared', () => {
  setup(searchProps);

  userEvent.click(screen.getByRole('button', { name: 'close-circle' }));

  expect(searchProps.onSearchTextChange).toHaveBeenCalledWith('');
  expect(searchProps.onClearSearch).toHaveBeenCalledTimes(1);
  expect(searchProps.onSearch).not.toHaveBeenCalled();
});

test('should clear the applied search when submitting an empty query', () => {
  setup({ ...searchProps, searchText: '   ' });

  userEvent.click(screen.getByRole('button', { name: 'Search' }));

  expect(searchProps.onClearSearch).toHaveBeenCalledTimes(1);
  expect(searchProps.onSearch).not.toHaveBeenCalled();
});

test('should export the requested file format', () => {
  const onExport = jest.fn();
  setup({ canExport: true, onExport, totalCount: 10 });

  userEvent.click(screen.getByRole('button', { name: 'Download as CSV' }));
  userEvent.click(screen.getByRole('button', { name: 'Download as Excel' }));

  expect(onExport).toHaveBeenNthCalledWith(1, 'csv');
  expect(onExport).toHaveBeenNthCalledWith(2, 'xlsx');
});

test('should hide exports when the user cannot export', () => {
  setup({ canExport: false, onExport: jest.fn(), totalCount: 10 });

  expect(
    screen.queryByRole('button', { name: 'Download as CSV' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Download as Excel' }),
  ).not.toBeInTheDocument();
});

test.each([
  { loading: true, totalCount: 10 },
  { exporting: true, totalCount: 10 },
  { totalCount: 0 },
])('should disable exports when unavailable: %j', overrides => {
  const onExport = jest.fn();
  setup({ canExport: true, onExport, ...overrides });

  expect(
    screen.getByRole('button', { name: 'Download as CSV' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Download as Excel' }),
  ).toBeDisabled();
  userEvent.click(screen.getByRole('button', { name: 'Download as CSV' }));
  expect(onExport).not.toHaveBeenCalled();
});

test.each([{ loading: true }, { exporting: true }])(
  'should disable search controls while busy: %j',
  overrides => {
    setup({ ...searchProps, ...overrides });

    expect(
      screen.getByRole('combobox', { name: 'Search column' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('searchbox', { name: 'Search detail records' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
  },
);
