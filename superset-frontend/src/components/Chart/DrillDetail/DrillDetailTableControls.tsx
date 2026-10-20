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

import { useCallback, useMemo } from 'react';
import { Tag } from 'src/components/Tag';
import { t } from '@apache-superset/core/translation';
import {
  BinaryQueryObjectFilterClause,
  isAdhocColumn,
} from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/theme';
import RowCountLabel from 'src/components/RowCountLabel';
import { Icons } from '@superset-ui/core/components/Icons';
import { Button, Input, Select } from '@superset-ui/core/components';

export type TableControlsProps = {
  filters: BinaryQueryObjectFilterClause[];
  setFilters: (filters: BinaryQueryObjectFilterClause[]) => void;
  totalCount?: number;
  loading: boolean;
  onReload: () => void;
  searchColumns?: { value: string; label: string }[];
  searchColumn?: string;
  searchText?: string;
  onSearchColumnChange?: (column: string) => void;
  onSearchTextChange?: (text: string) => void;
  onSearch?: () => void;
  onClearSearch?: () => void;
  onExport?: (format: 'csv' | 'xlsx') => void;
  exporting?: boolean;
  canExport?: boolean;
};

export default function TableControls({
  filters,
  setFilters,
  totalCount,
  loading,
  onReload,
  searchColumns = [],
  searchColumn,
  searchText = '',
  onSearchColumnChange,
  onSearchTextChange,
  onSearch,
  onClearSearch,
  onExport,
  exporting = false,
  canExport = false,
}: TableControlsProps) {
  const theme = useTheme();
  const busy = loading || exporting;
  const filterMap: Record<string, BinaryQueryObjectFilterClause> = useMemo(
    () =>
      Object.assign(
        {},
        ...filters.map(filter => ({
          [isAdhocColumn(filter.col)
            ? (filter.col.label as string)
            : filter.col]: filter,
        })),
      ),
    [filters],
  );

  const removeFilter = useCallback(
    colName => {
      const updatedFilterMap = { ...filterMap };
      delete updatedFilterMap[colName];
      setFilters(Object.values(updatedFilterMap));
    },
    [filterMap, setFilters],
  );

  const filterTags = useMemo(
    () =>
      Object.entries(filterMap)
        .map(([colName, { val, formattedVal }]) => ({
          colName,
          val: formattedVal ?? val,
        }))
        .sort((a, b) => a.colName.localeCompare(b.colName)),
    [filterMap],
  );

  return (
    <div
      css={css`
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: ${theme.sizeUnit * 2}px;
        padding: ${theme.sizeUnit / 2}px 0;
        margin-bottom: ${theme.sizeUnit * 2}px;
      `}
    >
      <div
        css={css`
          display: flex;
          flex-wrap: wrap;
          flex-basis: 100%;
        `}
      >
        {filterTags.map(({ colName, val }, index) => (
          <Tag
            editable
            onDelete={removeFilter.bind(null, colName)}
            index={index}
            id={index}
            key={colName}
            name={`${colName}=${val}`}
            data-test="filter-col"
          >
            <span
              css={css`
                margin-right: ${theme.sizeUnit}px;
              `}
            >
              {colName}
            </span>
            <strong data-test="filter-val">{val}</strong>
          </Tag>
        ))}
      </div>
      {onSearch && searchColumns.length > 0 && (
        <div
          css={css`
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: ${theme.sizeUnit * 2}px;
            flex: 1 1 320px;
          `}
        >
          <Select
            ariaLabel={t('Search column')}
            value={searchColumn}
            options={searchColumns}
            disabled={busy}
            onChange={value => {
              if (typeof value === 'string') {
                onSearchColumnChange?.(value);
              }
            }}
            css={css`
              min-width: 160px;
              flex: 1 1 160px;
            `}
          />
          <Input.Search
            aria-label={t('Search detail records')}
            placeholder={t('Search detail records')}
            value={searchText}
            allowClear
            enterButton={t('Search')}
            disabled={busy}
            onChange={event => onSearchTextChange?.(event.target.value)}
            onSearch={value => {
              if (value.trim()) {
                onSearch();
              } else {
                onClearSearch?.();
              }
            }}
            css={css`
              min-width: 200px;
              flex: 2 1 240px;
            `}
          />
        </div>
      )}
      <div
        css={css`
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: ${theme.sizeUnit * 2}px;
          height: min-content;
          margin-left: auto;
        `}
      >
        {canExport && onExport && (
          <>
            <Button
              disabled={busy || totalCount === 0}
              onClick={() => onExport('csv')}
            >
              {t('Download as CSV')}
            </Button>
            <Button
              disabled={busy || totalCount === 0}
              onClick={() => onExport('xlsx')}
            >
              {t('Download as Excel')}
            </Button>
          </>
        )}
        <RowCountLabel loading={loading && !totalCount} rowcount={totalCount} />
        <Icons.ReloadOutlined
          iconColor={theme.colorIcon}
          iconSize="l"
          aria-label={t('Reload')}
          role="button"
          onClick={onReload}
        />
      </div>
    </div>
  );
}
