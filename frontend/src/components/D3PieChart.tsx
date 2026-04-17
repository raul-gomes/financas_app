import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface PieChartData {
  category: string;
  value: number;
  color: string;
}

interface D3PieChartProps {
  data: PieChartData[];
  width?: number;
  height?: number;
}

export function D3PieChart({ data, width = 400, height = 300 }: D3PieChartProps) {
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
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    const pie = d3.pie<PieChartData>()
      .value(d => d.value)
      .sort(null);

    const arc = d3.arc<d3.PieArcDatum<PieChartData>>()
      .innerRadius(0)
      .outerRadius(radius);

    const labelArc = d3.arc<d3.PieArcDatum<PieChartData>>()
      .innerRadius(radius * 0.7)
      .outerRadius(radius * 0.7);

    const arcs = g.selectAll('.arc')
      .data(pie(data))
      .enter()
      .append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('opacity', 0.8)
      .on('mouseover', function() {
        d3.select(this).style('opacity', 1);
      })
      .on('mouseout', function() {
        d3.select(this).style('opacity', 0.8);
      });

    arcs.append('text')
      .attr('transform', d => `translate(${labelArc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', 'hsl(var(--foreground))')
      .text(d => {
        const percentage = ((d.data.value / d3.sum(data, d => d.value)) * 100).toFixed(1);
        return `${percentage}%`;
      });

  }, [data, width, height]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ background: 'transparent' }}
    />
  );
}