/* tslint:disable:quotemark */

import {assert} from 'chai';
import {Mark} from 'vega-lite/build/src/mark';
import {Channel} from 'vega-lite/build/src/channel';
import {Type} from 'vega-lite/build/src/type';
import {DEFAULT_QUERY_CONFIG} from '../src/config';
import {SpecQueryModel, SpecQueryModelGroup} from '../src/model';
import {isSpecQueryGroup, getTopSpecQueryItem} from '../src/specquerygroup';
import {Property} from '../src/property';
import {Query} from '../src/query/query';
import {recommend} from '../src/recommend';
import {getScore} from '../src/ranking/ranking';
import {SHORT_WILDCARD, Wildcard} from '../src/wildcard';
import {duplicate} from '../src/util';
import {schema} from './fixture';



describe('recommend()', () => {
  it('recommends line for a histogram of a temporal field', () => {
    const group = recommend({
      "spec": {
        "data": {"url": "data/cars.json"},
        "transform": [],
        "mark": "?",
        "encodings": [
          {
            "channel": "x",
            "timeUnit": "year",
            "field": "T1",
            "type": "temporal"
          },
          {
            "channel": "y",
            "field": "*",
            "type": "quantitative",
            "aggregate": "count"
          }
        ],
        "config": {
          "overlay": {"line": true},
          "scale": {"useUnaggregatedDomain": true}
        }
      },
      "groupBy": "encoding",
      "orderBy": ["fieldOrder","aggregationQuality","effectiveness"],
      "chooseBy": ["aggregationQuality","effectiveness"],
      "config": {"autoAddCount": false}
    }, schema);

    assert.equal(getTopSpecQueryItem(group.result).getMark(), 'line');
  });

  it('recommends bar for a histogram of a temporal field', () => {
    const group = recommend({
      "spec": {
        "data": {"url": "data/cars.json"},
        "transform": [],
        "mark": "?",
        "encodings": [
          {
            "channel": "x",
            "bin": true,
            "field": "Q1",
            "type": "quantitative"
          }
        ]
      },
      "groupBy": "encoding",
      "orderBy": ["fieldOrder","aggregationQuality","effectiveness"],
      "chooseBy": ["aggregationQuality","effectiveness"],
      "config": {"autoAddCount": true}
    }, schema);

    assert.equal(getTopSpecQueryItem(group.result).getMark(), 'bar');
  });


  it('recommends bar for a histogram of a temporal field', () => {
    const group = recommend({
      "spec": {
        "data": {"url": "data/movies.json"},
        "transform": [],
        "mark": "?",
        "encodings": [
          {
            "channel": "y",
            "field": "title",
            "type": "key"
          }
        ]
      },
      "groupBy": "encoding",
      "orderBy": ["fieldOrder","aggregationQuality","effectiveness"],
      "chooseBy": ["aggregationQuality","effectiveness"],
      "config": {"autoAddCount": true}
    }, schema);

    assert.equal(getTopSpecQueryItem(group.result).getMark(), 'bar');
  });

  describe('omitAggregatePlotWithoutDimension', () => {
    it('?(Q) x ?(Q) should not produce MEAN(Q)xMEAN(Q) if omitAggregatePlotWithoutDimension is enabled.', () => {
      const q = {
        spec: {
          mark: Mark.POINT,
          encodings:[
            {
              channel: Channel.X,
              bin: SHORT_WILDCARD,
              aggregate: SHORT_WILDCARD,
              field: 'Q',
              type: Type.QUANTITATIVE
            },
            {
              channel: Channel.Y,
              bin: SHORT_WILDCARD,
              aggregate: SHORT_WILDCARD,
              field: 'Q1',
              type: Type.QUANTITATIVE
            }
          ],
        },
        nest: [{
          groupBy: [Property.FIELD, Property.AGGREGATE, Property.BIN, Property.TIMEUNIT]
        }],
        config: {
          autoAddCount: true,
          omitAggregatePlotWithoutDimension: true
        }
      };
      const CONFIG_WITH_OMIT_AGGREGATE_PLOT_WITHOUT_DIMENSION = {
        ...DEFAULT_QUERY_CONFIG,
        omitAggregatePlotWithoutDimension: true
      };

      const result = recommend(q, schema, CONFIG_WITH_OMIT_AGGREGATE_PLOT_WITHOUT_DIMENSION).result;
      assert.equal(result.items.length, 6);
    });

    it('?(Q) x ?(Q) should produce MEAN(Q)xMEAN(Q) if omitAggregatePlotWithoutDimension is disabled.', () => {
      const q = {
        spec: {
          mark: Mark.POINT,
          encodings:[
            {
            channel: Channel.X,
            bin: SHORT_WILDCARD,
            aggregate: SHORT_WILDCARD,
            field: 'Q',
            type: Type.QUANTITATIVE
            },
            {
            channel: Channel.Y,
            bin: SHORT_WILDCARD,
            aggregate: SHORT_WILDCARD,
            field: 'Q1',
            type: Type.QUANTITATIVE
            }
          ],
        },
        nest: [{
          groupBy: [Property.FIELD, Property.AGGREGATE, Property.BIN, Property.TIMEUNIT]
        }],
        config: {
          autoAddCount: true,
          omitAggregatePlotWithoutDimension: false
        }
      };
      const CONFIG_WITH_OMIT_AGGREGATE_PLOT_WITHOUT_DIMENSION = {
        ...DEFAULT_QUERY_CONFIG,
        omitAggregatePlotWithoutDimension: false
      };
      const result = recommend(q, schema, CONFIG_WITH_OMIT_AGGREGATE_PLOT_WITHOUT_DIMENSION).result;
      assert.equal(result.items.length, 7);
    });
  });

  describe('nested query', () => {
    const q: Query = {
      spec: {
        mark: '?',
        encodings: [
          {channel: Channel.X, field: '*', type: Type.QUANTITATIVE}
        ]
      },
      nest: [
        {groupBy: 'fieldTransform'}
      ],
      orderBy: 'effectiveness',
    };
    const qCopy = duplicate(q);
    const output = recommend(q, schema);
    const result = output.result;

    it('enumerates a nested query correctly ', () => {
      assert.isTrue(isSpecQueryGroup(result.items[0]));
      if (isSpecQueryGroup(result.items[0])) {
        const group1: SpecQueryModelGroup = <SpecQueryModelGroup> result.items[0];
        assert.isFalse(isSpecQueryGroup(group1.items[0]));
        assert.equal(group1.items.length, 2);
        assert.equal((<SpecQueryModel>group1.items[0]).specQuery.mark, 'tick');
        assert.equal((<SpecQueryModel>group1.items[1]).specQuery.mark, 'point');
      }
    });

    it('should augment wildcard name for wildcards', () => {
      assert.isDefined((output.query.spec.mark as Wildcard<Mark>).name);
    });

    it('should not cause side effect to the original query object.', () => {
      assert.deepEqual(q, qCopy);
    });
  });

  describe('rank', () => {
    it('should sort SpecQueryModelGroup\'s items when passed orderBy is an array', () => {
      const q: Query = {
        spec: {
          mark: '?',
          encodings: [
            {channel: '?', bin: '?', aggregate: '?', field: 'Q', type: Type.QUANTITATIVE},
            {channel: '?', bin: '?', aggregate: '?', field: 'Q1', type: Type.QUANTITATIVE}
          ]
        },
        orderBy: ['aggregationQuality', 'effectiveness']
      };

      const output = recommend(q, schema);
      const result = output.result;

      function score(item: any, rankingName: string) {
        return getScore(item, rankingName, schema, DEFAULT_QUERY_CONFIG);
      }

      for (let i = 1; i < result.items.length; i++) {
        let prev = result.items[i-1];
        let cur = result.items[i];


        assert.isTrue(
          score(prev, 'aggregationQuality') >= score(cur, 'aggregationQuality') ||
          (
            score(prev, 'aggregationQuality') === score(cur, 'aggregationQuality') &&
            score(prev, 'effectiveness') >= score(cur, 'effectiveness')
          )
        );
      }
    });
  });

  it('enumerates a flat query correctly ', () => {
    const q: Query = {
      spec: {
        mark: '?',
        encodings: [
          {channel: Channel.X, field: '*', type: Type.QUANTITATIVE}
        ]
      },
      orderBy: 'effectiveness',
    };
    const result = recommend(q, schema).result;
    assert.isFalse(isSpecQueryGroup(result.items[0]));
    assert.equal(result.items.length, 2);
    assert.equal((<SpecQueryModel>result.items[0]).specQuery.mark, 'tick');
    assert.equal((<SpecQueryModel>result.items[1]).specQuery.mark, 'point');
  });
});
