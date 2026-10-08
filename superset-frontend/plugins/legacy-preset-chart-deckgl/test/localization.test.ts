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
import Handlebars from 'handlebars';
import { QueryFormData } from '@superset-ui/core';
import { addTranslations, configure } from '@apache-superset/core/translation';
import { createDefaultTemplateWithLimits } from '../src/utilities/multiValueUtils';

test('localized tooltip templates retain data field names and counts', () => {
  configure();
  addTranslations({ Total: ['合计'], 'N/A': ['暂无数据'] });
  const handlebars = Handlebars.create();
  handlebars.registerHelper('limit', (values: string[], limit: number) =>
    values.slice(0, limit).join(', '),
  );
  try {
    const template = createDefaultTemplateWithLimits(
      [{ item_type: 'column', column_name: 'box_type', verbose_name: '箱型' }],
      { viz_type: 'deck_screengrid' } as QueryFormData,
    );
    const render = handlebars.compile(template);
    expect(
      render({ box_types: ['小泡沫箱', '大泡沫箱'], box_type_count: 2 }),
    ).toBe('<div><strong>箱型:</strong> 小泡沫箱, 大泡沫箱 (合计: 2)</div>');
    expect(render({})).toBe('<div><strong>箱型:</strong> 暂无数据</div>');
    expect(template).toContain('{{box_type_count}}');
    expect(template).not.toContain(' total)');
  } finally {
    configure();
  }
});
