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
import { Form } from '@superset-ui/core/components';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import { PermissionsField } from './RoleFormItems';
import { clearPermissionSearchCache } from './utils';

const getMock = jest.spyOn(SupersetClient, 'get');

afterEach(() => {
  getMock.mockReset();
  clearPermissionSearchCache();
});

test.each(['can drill', 'can_drill', ' CAN_DRILL '])(
  'permission selector displays matching named permissions for %s',
  async search => {
    getMock.mockResolvedValue({
      json: {
        count: 2,
        result: [
          {
            id: 229,
            permission: { name: 'can_drill' },
            view_menu: { name: 'Dashboard' },
          },
          {
            id: 7,
            permission: { name: 'can_read' },
            view_menu: { name: 'Chart' },
          },
        ],
      },
    } as Awaited<ReturnType<typeof SupersetClient.get>>);
    const addDangerToast = jest.fn();
    render(
      <div className="ant-modal-content">
        <Form>
          <PermissionsField addDangerToast={addDangerToast} />
        </Form>
      </div>,
    );
    const input = screen.getByRole('combobox');
    fireEvent.mouseDown(input);
    expect(await screen.findByText('can read Chart')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: search } });
    await waitFor(() =>
      expect(screen.queryByText('can read Chart')).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('can drill Dashboard')).toBeInTheDocument();
    expect(addDangerToast).not.toHaveBeenCalled();
  },
);
