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
  DatasourceType,
  QueryContext,
  QueryFormData,
  SupersetClient,
} from '@superset-ui/core';
import { getDrillPayload } from './utils';

export type DrillExportPayload = Omit<
  QueryContext,
  'form_data' | 'result_format'
> & {
  form_data: { dashboardId?: number };
  result_format: 'csv' | 'xlsx';
};

/** Build a literal substring filter without interpolating text into SQL. */
export function buildSearchFilter(
  column: string,
  text: string,
): BinaryQueryObjectFilterClause | undefined {
  const value = text.trim();
  if (!column || !value) {
    return undefined;
  }
  return {
    col: column,
    op: 'ILIKE',
    val: `%${value.replace(/[\\%_]/g, '\\$&')}%`,
  };
}

/** Export detail rows with the supplied query scope, starting at the first row. */
export function buildDrillExportPayload(
  formData: QueryFormData,
  filters: BinaryQueryObjectFilterClause[],
  format: 'csv' | 'xlsx',
  rowLimit: number,
  dashboardId?: number,
  columns?: { column_name: string; verbose_name?: string | null }[],
): DrillExportPayload {
  const [datasourceId, datasourceType] = formData.datasource.split('__');
  const query = getDrillPayload(formData, filters);
  const queryFilters = query?.filters.map(filter => {
    if (typeof filter.col !== 'string') {
      return filter;
    }
    const column =
      columns?.find(candidate => candidate.column_name === filter.col) ??
      columns?.find(candidate => candidate.verbose_name === filter.col);
    return column ? { ...filter, col: column.column_name } : filter;
  });
  return {
    datasource: {
      id: Number(datasourceId),
      type: datasourceType as DatasourceType,
    },
    queries: [
      {
        ...query,
        filters: queryFilters,
        row_limit: rowLimit,
        row_offset: 0,
      },
    ],
    form_data: { dashboardId },
    result_type: 'drill_detail',
    result_format: format,
    force: true,
  };
}

/** Download through the chart data API and propagate failures to the caller. */
export async function exportDrillDetail(
  payload: DrillExportPayload,
  filename: string,
): Promise<void> {
  const response = await SupersetClient.post({
    endpoint: '/api/v1/chart/data',
    jsonPayload: payload,
    parseMethod: 'raw',
  });
  const blob = await response.blob();
  let downloadBlob = blob;
  if (payload.result_format === 'csv') {
    const prefix = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
    if (prefix[0] !== 0xef || prefix[1] !== 0xbb || prefix[2] !== 0xbf) {
      downloadBlob = new Blob(['\uFEFF', blob], {
        type: blob.type || 'text/csv;charset=utf-8',
      });
    }
  }
  const url = window.URL.createObjectURL(downloadBlob);
  const anchor = document.createElement('a');
  try {
    anchor.href = url;
    const extension = `.${payload.result_format}`;
    anchor.download = filename.endsWith(extension)
      ? filename
      : `${filename}${extension}`;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }
}
