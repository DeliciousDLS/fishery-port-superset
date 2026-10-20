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
  cloneElement,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import {
  BinaryQueryObjectFilterClause,
  DatasourceType,
  ensureIsArray,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/theme';
import { GenericDataType } from '@apache-superset/core/common';
import { useResizeDetector } from 'react-resize-detector';
import BooleanCell from '@superset-ui/core/components/Table/cell-renderers/BooleanCell';
import NullCell from '@superset-ui/core/components/Table/cell-renderers/NullCell';
import TimeCell from '@superset-ui/core/components/Table/cell-renderers/TimeCell';
import { Alert, EmptyState, Loading } from '@superset-ui/core/components';
import { getDatasourceSamples } from 'src/components/Chart/chartAction';
import Table, {
  ColumnsType,
  TableSize,
} from '@superset-ui/core/components/Table';
import { RootState } from 'src/dashboard/types';
import HeaderWithRadioGroup from '@superset-ui/core/components/Table/header-renderers/HeaderWithRadioGroup';
import { useDatasetMetadataBar } from 'src/features/datasets/metadataBar/useDatasetMetadataBar';
import { findPermission } from 'src/utils/findPermission';
import { Dataset } from '../types';
import TableControls from './DrillDetailTableControls';
import { getDrillPayload } from './utils';
import { ResultsPage } from './types';
import {
  buildSearchFilter,
  buildDrillExportPayload,
  exportDrillDetail,
} from './searchAndExport';

const PAGE_SIZE = 50;

interface DataType {
  [key: string]: any;
}

// Must be outside of the main component due to problems in
// react-resize-detector with conditional rendering
// https://github.com/maslianok/react-resize-detector/issues/178
function Resizable({ children }: { children: ReactElement }) {
  const { ref, height } = useResizeDetector();
  return (
    <div ref={ref} css={{ flex: 1 }}>
      {cloneElement(children, { height })}
    </div>
  );
}

enum TimeFormatting {
  Original,
  Formatted,
}

export default function DrillDetailPane({
  formData,
  initialFilters,
  dataset,
}: {
  formData: QueryFormData;
  initialFilters: BinaryQueryObjectFilterClause[];
  dataset?: Dataset;
}) {
  const theme = useTheme();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [filters, setFilters] = useState(initialFilters);
  const [searchColumn, setSearchColumn] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchFilter, setSearchFilter] =
    useState<BinaryQueryObjectFilterClause>();
  const [searchColumns, setSearchColumns] = useState<
    { value: string; label: string }[]
  >([]);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [responseError, setResponseError] = useState('');
  const [resultsPage, setResultsPage] = useState<ResultsPage>();
  const [timeFormatting, setTimeFormatting] = useState<
    Record<string, TimeFormatting>
  >({});

  const dashboardId = useSelector<RootState, number>(
    ({ dashboardInfo }) => dashboardInfo.id,
  );

  const exportRowLimit = useSelector(
    (state: { common: { conf: JsonObject } }) =>
      Number(state.common.conf.SQL_MAX_ROW) || 100000,
  );
  const canExport = useSelector((state: RootState) =>
    findPermission('can_csv', 'Superset', state.user?.roles),
  );
  const effectiveFilters = useMemo(
    () => [...filters, ...(searchFilter ? [searchFilter] : [])],
    [filters, searchFilter],
  );

  // Extract datasource ID/type from string ID
  const [datasourceId, datasourceType] = useMemo(
    () => formData.datasource.split('__'),
    [formData.datasource],
  );

  const { metadataBar: metadataBarComponent } = useDatasetMetadataBar({
    dataset,
  });

  const mappedColumns: ColumnsType<DataType> = useMemo(
    () =>
      resultsPage?.colNames.map((column, index) => ({
        key: column,
        dataIndex: column,
        title:
          resultsPage?.colTypes[index] === GenericDataType.Temporal ? (
            <HeaderWithRadioGroup
              headerTitle={dataset?.verbose_map?.[column] || column}
              groupTitle={t('Formatting')}
              groupOptions={[
                { label: t('Original value'), value: TimeFormatting.Original },
                {
                  label: t('Formatted value'),
                  value: TimeFormatting.Formatted,
                },
              ]}
              value={
                timeFormatting[column] === TimeFormatting.Original
                  ? TimeFormatting.Original
                  : TimeFormatting.Formatted
              }
              onChange={value =>
                setTimeFormatting(state => ({
                  ...state,
                  [column]: parseInt(value, 10) as TimeFormatting,
                }))
              }
            />
          ) : (
            dataset?.verbose_map?.[column] || column
          ),
        render: value => {
          if (value === true || value === false) {
            return <BooleanCell value={value} />;
          }
          if (value === null) {
            return <NullCell />;
          }
          if (
            resultsPage?.colTypes[index] === GenericDataType.Temporal &&
            timeFormatting[column] !== TimeFormatting.Original &&
            (typeof value === 'number' || value instanceof Date)
          ) {
            return <TimeCell value={value} />;
          }
          return String(value);
        },
        width: 150,
      })) || [],
    [
      resultsPage?.colNames,
      resultsPage?.colTypes,
      timeFormatting,
      dataset?.verbose_map,
    ],
  );

  const data: DataType[] = useMemo(
    () =>
      resultsPage?.data.map((row, index) =>
        resultsPage?.colNames.reduce(
          (acc, curr) => ({ ...acc, [curr]: row[curr] }),
          {
            key: index,
          },
        ),
      ) || [],
    [resultsPage?.colNames, resultsPage?.data],
  );

  const resetResults = useCallback(() => {
    setResponseError('');
    setExportError('');
    setResultsPage(undefined);
    setPageIndex(0);
    setReloadVersion(value => value + 1);
  }, []);

  const handleReload = useCallback(() => resetResults(), [resetResults]);
  const handleFilters = useCallback(
    (nextFilters: BinaryQueryObjectFilterClause[]) => {
      setFilters(nextFilters);
      resetResults();
    },
    [resetResults],
  );
  const handleSearch = useCallback(() => {
    setSearchFilter(buildSearchFilter(searchColumn, searchText));
    resetResults();
  }, [searchColumn, searchText, resetResults]);
  const handleClearSearch = useCallback(() => {
    setSearchText('');
    setSearchFilter(undefined);
    resetResults();
  }, [resetResults]);
  const handleSearchColumn = useCallback(
    (column: string) => {
      setSearchColumn(column);
      setSearchText('');
      setSearchFilter(undefined);
      resetResults();
    },
    [resetResults],
  );

  // Cancel stale responses when paging, reloading, or changing filters.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setResponseError('');
    getDatasourceSamples(
      datasourceType as DatasourceType,
      Number(datasourceId),
      false,
      getDrillPayload(formData, effectiveFilters) ?? {},
      pageSize,
      pageIndex + 1,
      dashboardId,
    )
      .then(response => {
        if (cancelled) return;
        const colNames: string[] = ensureIsArray(response.colnames);
        const colTypes: GenericDataType[] = ensureIsArray(response.coltypes);
        setResultsPage({
          total: response.total_count,
          data: response.data,
          colNames,
          colTypes,
        });
        // Keep searchable columns available after a query returns no matches.
        if (colNames.length) {
          const columns = colNames
            .filter(
              (column, index) => colTypes[index] === GenericDataType.String,
            )
            .map(column => ({
              value: column,
              label: dataset?.verbose_map?.[column] || column,
            }));
          setSearchColumns(columns);
          setSearchColumn(current =>
            columns.some(column => column.value === current)
              ? current
              : (columns.find(column => column.value === '车牌号')?.value ??
                columns[0]?.value ??
                ''),
          );
        }
      })
      .catch(error => {
        if (!cancelled) setResponseError(`${error.name}: ${error.message}`);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    datasourceId,
    datasourceType,
    effectiveFilters,
    formData,
    pageIndex,
    pageSize,
    dashboardId,
    reloadVersion,
    dataset?.verbose_map,
  ]);

  const handleExport = useCallback(
    async (format: 'csv' | 'xlsx') => {
      if (!canExport || exporting || isLoading || !resultsPage?.total) return;
      setExporting(true);
      setExportError('');
      try {
        const payload = buildDrillExportPayload(
          formData,
          effectiveFilters,
          format,
          Math.min(resultsPage.total, exportRowLimit),
          dashboardId,
          dataset?.columns,
        );
        await exportDrillDetail(
          payload,
          `${dataset?.table_name || 'detail'}.${format}`,
        );
      } catch {
        setExportError(t('Export failed. Please try again.'));
      } finally {
        setExporting(false);
      }
    },
    [
      canExport,
      exporting,
      isLoading,
      resultsPage?.total,
      formData,
      effectiveFilters,
      exportRowLimit,
      dashboardId,
      dataset?.table_name,
      dataset?.columns,
    ],
  );

  const bootstrapping = !responseError && !resultsPage;

  const allowHTML = formData.allow_render_html ?? true;

  let tableContent = null;
  if (responseError) {
    // Render error if page download failed
    tableContent = (
      <pre
        css={css`
          margin-top: ${theme.sizeUnit * 4}px;
        `}
      >
        {responseError}
      </pre>
    );
  } else if (bootstrapping) {
    // Render loading if first page hasn't loaded
    tableContent = <Loading />;
  } else if (resultsPage?.total === 0) {
    // Render empty state if no results are returned for page
    const title = t('No rows were returned for this dataset');
    tableContent = <EmptyState image="document.svg" title={title} />;
  } else {
    // Render table if at least one page has successfully loaded
    tableContent = (
      <Resizable>
        <Table
          key={reloadVersion}
          data={data}
          columns={mappedColumns}
          size={TableSize.Small}
          defaultPageSize={pageSize}
          recordCount={resultsPage?.total}
          usePagination
          loading={isLoading}
          onChange={pagination => {
            const nextPageSize = pagination.pageSize ?? pageSize;
            if (nextPageSize !== pageSize) {
              setPageSize(nextPageSize);
              resetResults();
            } else {
              setPageIndex(pagination.current ? pagination.current - 1 : 0);
            }
          }}
          resizable
          virtualize
          allowHTML={allowHTML}
        />
      </Resizable>
    );
  }

  return (
    <>
      {metadataBarComponent}
      <TableControls
        filters={filters}
        setFilters={handleFilters}
        totalCount={resultsPage?.total}
        loading={isLoading || bootstrapping}
        onReload={handleReload}
        searchColumns={searchColumns}
        searchColumn={searchColumn}
        searchText={searchText}
        onSearchColumnChange={handleSearchColumn}
        onSearchTextChange={setSearchText}
        onSearch={handleSearch}
        onClearSearch={handleClearSearch}
        onExport={handleExport}
        exporting={exporting}
        canExport={canExport}
      />
      {canExport && (resultsPage?.total ?? 0) > exportRowLimit && (
        <Alert
          type="warning"
          message={t(
            'Export is limited to %s rows. Narrow your search to export all matches.',
            exportRowLimit,
          )}
        />
      )}
      {exportError && <Alert type="error" message={exportError} />}
      {tableContent}
    </>
  );
}
