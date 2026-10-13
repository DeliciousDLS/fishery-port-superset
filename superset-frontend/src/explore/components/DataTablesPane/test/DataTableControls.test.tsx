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
import { configure } from '@apache-superset/core/translation';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import {
  TableControls,
  getRowLimitOptions,
} from '../components/DataTableControls';

afterEach(() => configure());

test.each([
  ['en', '50 rows', '100 rows'],
  ['zh', '50行', '100行'],
])('renders the row-limit selector in %s', async (locale, current, next) => {
  if (locale === 'zh') {
    configure({
      languagePack: {
        domain: 'superset',
        locale_data: {
          superset: {
            '': {
              domain: 'superset',
              lang: 'zh',
              plural_forms: 'nplurals=1; plural=0;',
            },
            '%s row': ['%s行'],
          },
        },
      },
    });
  }
  const onChange = jest.fn();
  render(
    <TableControls
      data={[]}
      columnNames={[]}
      columnTypes={[]}
      rowcount={50}
      isLoading={false}
      canDownload={false}
      onInputChange={jest.fn()}
      rowLimit={50}
      rowLimitOptions={getRowLimitOptions()}
      onRowLimitChange={onChange}
    />,
  );
  expect(screen.getByText(current)).toBeVisible();
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(
    screen
      .getAllByText(next)
      .find(element => element.closest('.ant-select-item-option-content'))!,
  );
  expect(onChange).toHaveBeenCalledWith(
    100,
    expect.objectContaining({ value: 100 }),
  );
});
