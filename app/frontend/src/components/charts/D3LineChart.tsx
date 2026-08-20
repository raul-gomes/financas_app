import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { PortfolioEvolution } from '@/types/financial';

interface D3LineChartProps {
  data: PortfolioEvolution[];
  width?: number;
  height?: number;
}

export function D3LineChart({ data, width = 800, height = 250 }: D3LineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, left: 60, bottom: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Parse dates and sort data
    const processedData = data.map(d => ({
      ...d,
      parsedDate: new Date(d.date + '-01')
    })).sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

    // Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(processedData, d => d.parsedDate) as [Date, Date])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(processedData, d => d.value) as [number, number])
      .nice()
      .range([innerHeight, 0]);

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Grid lines
    g.selectAll('.grid-line')
      .data(yScale.ticks(5))
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', 'hsl(var(--border))')
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.3);

    // Line generator
    const line = d3.line<typeof processedData[0]>()
      .x(d => xScale(d.parsedDate))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Add gradient
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'line-gradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', yScale(d3.min(processedData, d => d.value)!))
      .attr('x2', 0).attr('y2', yScale(d3.max(processedData, d => d.value)!));

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', 'hsl(var(--success))')
      .attr('stop-opacity', 0.1);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', 'hsl(var(--success))')
      .attr('stop-opacity', 0.8);

    // Add area under line
    const area = d3.area<typeof processedData[0]>()
      .x(d => xScale(d.parsedDate))
      .y0(innerHeight)
      .y1(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(processedData)
      .attr('fill', 'url(#line-gradient)')
      .attr('d', area);

    // Add line
    g.append('path')
      .datum(processedData)
      .attr('fill', 'none')
      .attr('stroke', 'hsl(var(--success))')
      .attr('stroke-width', 3)
      .attr('d', line);

    // Add dots
    g.selectAll('.dot')
      .data(processedData)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d.parsedDate))
      .attr('cy', d => yScale(d.value))
      .attr('r', 4)
      .attr('fill', 'hsl(var(--success))')
      .attr('stroke', 'hsl(var(--background))')
      .attr('stroke-width', 2);

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale)
        .tickFormat(d3.timeFormat('%b')))
      .selectAll('text')
      .attr('fill', 'hsl(var(--muted-foreground))')
      .style('font-size', '12px');

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(yScale)
        .tickFormat(d => `R$ ${(Number(d) / 1000).toFixed(0)}k`))
      .selectAll('text')
      .attr('fill', 'hsl(var(--muted-foreground))')
      .style('font-size', '12px');

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
      .style('z-index', '1000');

    // Add hover effects
    g.selectAll('.dot')
      .on('mouseover', function(event, d: any) {
        const formatCurrency = (amount: number) => {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'BRL'
          }).format(amount);
        };

        const formatDate = d3.timeFormat('%B %Y');
        
        tooltip
          .style('visibility', 'visible')
          .html(`
            <div>
              <strong>${formatDate(d.parsedDate)}</strong><br/>
              Valor da Carteira: ${formatCurrency(d.value)}
            </div>
          `);
      })
      .on('mousemove', function(event) {
        tooltip
          .style('top', (event.pageY - 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', function() {
        tooltip.style('visibility', 'hidden');
      });

    // Cleanup function
    return () => {
      d3.selectAll('.tooltip').remove();
    };
  }, [data, width, height]);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMinYMid meet"
        className="w-full h-auto max-w-full"
      />
    </div>
  );
}