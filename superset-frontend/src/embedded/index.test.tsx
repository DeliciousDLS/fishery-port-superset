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
import ReactDOM from 'react-dom';
import { waitFor } from '@testing-library/react';
import Switchboard from '@superset-ui/switchboard';
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';

jest.mock('src/public-path', () => ({}));
jest.mock('query-string', () => ({}));
jest.mock('@superset-ui/core/components/ThemedAgGridReact', () => ({
  setupAGGridModules: jest.fn(),
}));
jest.mock('@superset-ui/switchboard', () => ({
  init: jest.fn(),
  defineMethod: jest.fn(),
  start: jest.fn(),
}));
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  makeApi: () =>
    jest.fn().mockResolvedValue({ result: { roles: {}, permissions: [] } }),
}));
jest.mock('src/preamble', () => jest.fn().mockResolvedValue(undefined));
jest.mock('src/setup/setupClient', () => jest.fn());
jest.mock('src/setup/setupPlugins', () => jest.fn());
jest.mock('src/setup/setupCodeOverrides', () => jest.fn());
jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({
    embedded: { dashboard_id: '123' },
    common: {
      application_root: '/',
      static_assets_prefix: '/',
      conf: { SQLLAB_DEFAULT_DBID: 1, DEFAULT_SQLLAB_LIMIT: 1000 },
    },
  }),
  applicationRoot: () => '/',
  staticAssetsPrefix: () => '/',
}));

test('guest handshake initializes grid modules before rendering and token renewal does not remount', async () => {
  document.body.innerHTML = '<div id="app"></div>';
  const render = jest.spyOn(ReactDOM, 'render').mockImplementation(() => null);

  require('./index');
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: '__embedded_comms__', handshake: 'port transfer' },
      ports: [{} as MessagePort],
    }),
  );
  const guestMethod = jest
    .mocked(Switchboard.defineMethod)
    .mock.calls.find(([name]) => name === 'guestToken');
  expect(guestMethod).toBeDefined();
  const [, receiveToken] = guestMethod!;
  receiveToken({ guestToken: 'test-guest-token' });
  await waitFor(() => expect(render).toHaveBeenCalledTimes(1));

  expect(setupAGGridModules).toHaveBeenCalledTimes(1);
  expect(
    jest.mocked(setupAGGridModules).mock.invocationCallOrder[0],
  ).toBeLessThan(render.mock.invocationCallOrder[0]);

  receiveToken({ guestToken: 'refreshed-test-guest-token' });
  expect(setupAGGridModules).toHaveBeenCalledTimes(1);
  expect(render).toHaveBeenCalledTimes(1);
  render.mockRestore();
});
