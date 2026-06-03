import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface D3HorizontalBarChartProps {
  data: Array<{category: string, value: number, color: string}>;
  width?: number;
  height?: number;
}

export function D3HorizontalBarChart({ 
  data, 
  width = 400, 
  height = 300 
}: D3HorizontalBarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 100 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const container = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Escalas
    const yScale = d3.scaleBand()
      .domain(data.map(d => d.category))
      .range([0, innerHeight])
      .padding(0.2);

    const xScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) || 0])
      .range([0, innerWidth]);

    // Formatador de moeda
    const formatCurrency = (value: number) => 
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);

    // Barras
    container.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', d => yScale(d.category) || 0)
      .attr('width', d => xScale(d.value))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => d.color || 'hsl(var(--muted))')
      .attr('opacity', 0.8)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 1);
        
        // Tooltip
        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000');

        tooltip.html(`
          <div><strong>${d.category}</strong></div>
          <div>${formatCurrency(d.value)}</div>
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
      })
      .on('mousemove', function(event) {
        d3.select('.tooltip')
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 0.8);
        d3.select('.tooltip').remove();
      });

    // Labels dos valores
    container.selectAll('.value-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'value-label')
      .attr('x', d => xScale(d.value) + 5)
      .attr('y', d => (yScale(d.category) || 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .style('font-size', '11px')
      .style('fill', 'currentColor')
      .text(d => formatCurrency(d.value));

    // Eixo Y (categorias)
    const yAxis = d3.axisLeft(yScale)
      .tickSize(0);

    container.append('g')
      .call(yAxis)
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', 'currentColor');

    // Eixo X (valores) - removido conforme solicitação

    // Remover linhas dos eixos
    container.selectAll('.domain').remove();
    container.selectAll('.tick line').remove();

  }, [data, width, height]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMinYMid meet"
      className="w-full h-auto max-w-full"
    />
  );
}