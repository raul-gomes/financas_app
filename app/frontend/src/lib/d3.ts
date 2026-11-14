/**
 * Single entry point for the D3 modules the charts use.
 *
 * Importing the submodules (instead of the `d3` umbrella package) keeps the
 * bundle limited to what is actually called. Add a named export here when a
 * chart needs a new D3 function; charts use it as `import * as d3 from '@/lib/d3'`.
 */
// Side effect: adds `selection.transition()` to d3-selection.
import 'd3-transition';

export { select, selectAll } from 'd3-selection';
export { scaleLinear, scaleBand, scaleTime } from 'd3-scale';
export { arc, pie, line, area, curveMonotoneX } from 'd3-shape';
export type { PieArcDatum } from 'd3-shape';
export { axisBottom, axisLeft } from 'd3-axis';
export { max, min, sum, extent } from 'd3-array';
export { timeFormat } from 'd3-time-format';
export { easeElasticOut, easeBackOut } from 'd3-ease';
export { interpolate } from 'd3-interpolate';
