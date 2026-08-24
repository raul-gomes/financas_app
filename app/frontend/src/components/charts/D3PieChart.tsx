import { memo, useEffect, useRef } from 'react';
import { formatCurrency } from '@/lib/format';
import * as d3 from 'd3';

interface PieChartData {
  category: string;
  value: number;
  color: string;
  limit?: number; // Novo campo opcional
}

interface D3PieChartProps {
  data: PieChartData[];
  width?: number;
  height?: number;
}

function D3PieChartBase({ data, width = 400, height = 300 }: D3PieChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2}) rotate(-90)`);

    // Schedule rotation animation
    g.transition()
      .duration(800)
      .ease(d3.easeElasticOut.amplitude(0.6).period(0.4))
      .attr('transform', `translate(${width / 2}, ${height / 2}) rotate(0)`);

    const pie = d3.pie<PieChartData>()
      .value(d => d.value)
      .sort(null);

    const arc = d3.arc<d3.PieArcDatum<PieChartData>>()
      .innerRadius(0)
      .outerRadius(radius);

    const labelArc = d3.arc<d3.PieArcDatum<PieChartData>>()
      .innerRadius(radius * 0.7)
      .outerRadius(radius * 0.7);

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'hsl(var(--card))')
      .style('border', '1px solid hsl(var(--border))')
      .style('border-radius', '8px')
      .style('padding', '8px')
      .style('font-size', '12px')
      .style('box-shadow', '0 4px 6px -1px rgb(0 0 0 / 0.1)')
      .style('z-index', '1000')
      .style('pointer-events', 'none');

    const arcs = g.selectAll('.arc')
      .data(pie(data))
      .enter()
      .append('g')
      .attr('class', 'arc');

    const paths = arcs.append('path')
      .attr('fill', d => d.data.color)
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('opacity', 0.8)
      .style('cursor', 'pointer')
      // Initial state: radius 0
      .attr('d', d3.arc<d3.PieArcDatum<PieChartData>>().innerRadius(0).outerRadius(0) as any);

    // Animate arcs growing out
    paths.transition()
      .delay(300)
      .duration(600)
      .ease(d3.easeBackOut.overshoot(0.5))
      .attrTween('d', function(d) {
        const interpolate = d3.interpolate(0, radius);
        return function(t) {
          return d3.arc<d3.PieArcDatum<PieChartData>>()
            .innerRadius(0)
            .outerRadius(interpolate(t))(d);
        };
      });

    // Event handlers (on paths selection, not transition)
    paths.on('mouseover', function(event, d: any) {
        d3.select(this)
          .transition()
          .duration(200)
          .style('opacity', 1)
          .attr('transform', 'scale(1.05)');

        const totalSpent = d.data.value;
        const limit = d.data.limit || 0;
        const diff = limit - totalSpent;
        const percentage = ((totalSpent / d3.sum(data, d => d.value)) * 100).toFixed(1);

        let statusHtml = '';
        if (limit > 0) {
            if (diff >= 0) {
                statusHtml = `<div class="text-success mt-1">Faltam ${formatCurrency(diff)} para o limite</div>`;
            } else {
                statusHtml = `<div class="text-destructive mt-1">Extrapolou ${formatCurrency(Math.abs(diff))} do limite</div>`;
            }
        }

        tooltip
          .style('visibility', 'visible')
          .html(`
            <div class="space-y-1">
              <div class="font-bold border-b pb-1 mb-1">${d.data.category}</div>
              <div>Gasto: ${formatCurrency(totalSpent)} (${percentage}%)</div>
              ${limit > 0 ? `<div class="text-muted-foreground">Limite: ${formatCurrency(limit)}</div>` : ''}
              ${statusHtml}
            </div>
          `);
      })
      .on('mousemove', function(event) {
        tooltip
          .style('top', (event.pageY - 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .style('opacity', 0.8)
          .attr('transform', 'scale(1)');
        tooltip.style('visibility', 'hidden');
      });

    arcs.append('text')
      .attr('transform', d => `translate(${labelArc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', 'white') // Texto branco sobre as cores
      .style('pointer-events', 'none')
      .text(d => {
        const percentage = ((d.data.value / d3.sum(data, d => d.value)) * 100).toFixed(1);
        return parseFloat(percentage) > 5 ? `${percentage}%` : '';
      });

    // Cleanup function
    return () => {
      d3.selectAll('.tooltip').remove();
    };

  }, [data, width, height]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMinYMid meet"
      style={{ background: 'transparent', maxWidth: '100%', height: 'auto' }}
    />
  );
}

/** Memoizado: evita re-render do SVG quando props não mudam. */
export const D3PieChart = memo(D3PieChartBase);
