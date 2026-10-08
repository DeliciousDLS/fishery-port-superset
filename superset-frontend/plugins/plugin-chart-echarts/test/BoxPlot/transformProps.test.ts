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
import { ChartProps, SqlaFormData } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import { addTranslations, configure } from '@apache-superset/core/translation';
import type { BoxplotSeriesOption } from 'echarts/charts';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import { EchartsBoxPlotChartProps } from '../../src/BoxPlot/types';
import transformProps from '../../src/BoxPlot/transformProps';

describe('BoxPlot transformProps', () => {
  const formData: SqlaFormData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    time_grain_sqla: 'P1Y',
    columns: [],
    metrics: ['AVG(averageprice)'],
    groupby: ['type', 'region'],
    whiskerOptions: 'Tukey',
    yAxisFormat: 'SMART_NUMBER',
    viz_type: 'my_chart',
    zoomable: true,
  };
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          {
            type: 'organic',
            region: 'Charlotte',
            'AVG(averageprice)__mean': 1.9405512820512825,
            'AVG(averageprice)__median': 1.9025,
            'AVG(averageprice)__max': 2.505,
            'AVG(averageprice)__min': 1.4775,
            'AVG(averageprice)__q1': 1.73875,
            'AVG(averageprice)__q3': 2.105,
            'AVG(averageprice)__count': 39,
            'AVG(averageprice)__outliers': [2.735],
          },
          {
            type: 'organic',
            region: 'Hartford Springfield',
            'AVG(averageprice)__mean': 2.231141025641026,
            'AVG(averageprice)__median': 2.265,
            'AVG(averageprice)__max': 2.595,
            'AVG(averageprice)__min': 1.862,
            'AVG(averageprice)__q1': 2.1285,
            'AVG(averageprice)__q3': 2.32625,
            'AVG(averageprice)__count': 39,
            'AVG(averageprice)__outliers': [],
          },
        ],
      },
    ],
    theme: supersetTheme,
  });

  test('should transform chart props for viz', () => {
    expect(transformProps(chartProps as EchartsBoxPlotChartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          dataZoom: expect.arrayContaining([
            {
              moveOnMouseWheel: true,
              type: 'inside',
              zoomOnMouseWheel: false,
            },
          ]),
          series: expect.arrayContaining([
            expect.objectContaining({
              name: 'boxplot',
              data: expect.arrayContaining([
                expect.objectContaining({
                  name: 'organic, Charlotte',
                  value: [
                    1.4775,
                    1.73875,
                    1.9025,
                    2.105,
                    2.505,
                    1.9405512820512825,
                    39,
                    [2.735],
                  ],
                }),
                expect.objectContaining({
                  name: 'organic, Hartford Springfield',
                  value: [
                    1.862,
                    2.1285,
                    2.265,
                    2.32625,
                    2.595,
                    2.231141025641026,
                    39,
                    [],
                  ],
                }),
              ]),
            }),
            expect.objectContaining({
              name: 'outlier',
              data: [['organic, Charlotte', 2.735]],
            }),
          ]),
        }),
      }),
    );
  });

  test('translates statistic and zoom labels while preserving data and values', () => {
    configure();
    addTranslations({
      Max: ['最大值'],
      '3rd Quartile': ['第三四分位数'],
      Mean: ['平均值'],
      Median: ['中位数'],
      '1st Quartile': ['第一四分位数'],
      Min: ['最小值'],
      '# Observations': ['观测数'],
      '# Outliers': ['离群值数'],
      'zoom area': ['区域缩放'],
      'restore zoom': ['恢复缩放'],
    });
    try {
      const { echartOptions } = transformProps(
        chartProps as EchartsBoxPlotChartProps,
      );
      const series = (echartOptions.series as BoxplotSeriesOption[])[0];
      const formatter = series.tooltip?.formatter;
      expect(typeof formatter).toBe('function');
      if (typeof formatter !== 'function') {
        throw new Error('Expected statistic tooltip formatter');
      }
      const tooltip = formatter(
        {
          name: '小泡沫箱, SUM(price)',
          value: [0, 1, 2, 3, 4, 5, 6, 7, [9]],
        } as CallbackDataParams,
        '',
        () => '',
      );
      expect(tooltip).toContain('小泡沫箱, SUM(price)');
      expect(tooltip).toContain('最大值: 5');
      expect(tooltip).toContain('第三四分位数: 4');
      expect(tooltip).toContain('平均值: 6');
      expect(tooltip).toContain('中位数: 3');
      expect(tooltip).toContain('第一四分位数: 2');
      expect(tooltip).toContain('最小值: 1');
      expect(tooltip).toContain('观测数: 7');
      expect(tooltip).toContain('离群值数: 1');
      expect(echartOptions.toolbox).toEqual(
        expect.objectContaining({
          feature: {
            dataZoom: {
              title: { zoom: '区域缩放', back: '恢复缩放' },
            },
          },
        }),
      );
    } finally {
      configure();
    }
  });
});
