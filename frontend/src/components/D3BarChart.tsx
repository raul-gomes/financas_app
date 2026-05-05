import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { YearlyData } from '@/types/financial';

interface D3BarChartProps {
  data: YearlyData[];
  width?: number;
  height?: number;
  monthlyGoal?: number;
  onBarClick?: (month: string) => void;
}

export function D3BarChart({ 
  data, 
  width = 800, 
  height = 350, 
  monthlyGoal = 0,
  onBarClick
}: D3BarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous chart

    const margin = { top: 20, right: 30, left: 60, bottom: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Use data as is
    const processedData = data;

    // Scales
    const xScale = d3.scaleBand()
      .domain(processedData.map(d => d.month))
      .range([0, innerWidth])
      .padding(0.3);

    const maxValue = d3.max(processedData, d => Math.max(d.income, d.expenses, monthlyGoal)) || 0;
    const yScale = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .range([innerHeight, 0]);

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Grid lines
    g.selectAll('.grid-line')
      .data(yScale.ticks(6))
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

    // Income bars
    g.selectAll('.income-bar')
      .data(processedData)
      .enter()
      .append('rect')
      .attr('class', 'income-bar')
      .attr('x', d => xScale(d.month)! + 2)
      .attr('y', d => yScale(d.income))
      .attr('width', (xScale.bandwidth() / 2) - 4)
      .attr('height', d => innerHeight - yScale(d.income))
      .attr('fill', 'hsl(var(--success))')
      .attr('rx', 2);

    // Expense bars
    g.selectAll('.expense-bar')
      .data(processedData)
      .enter()
      .append('rect')
      .attr('class', 'expense-bar')
      .attr('x', d => xScale(d.month)! + (xScale.bandwidth() / 2) + 2)
      .attr('y', d => yScale(d.expenses))
      .attr('width', (xScale.bandwidth() / 2) - 4)
      .attr('height', d => {
        const h = innerHeight - yScale(d.expenses);
        return h > 2 ? h : 2;  // garante pelo menos 2px visíveis
      })
      .attr('fill', 'hsl(var(--destructive))')
      .attr('rx', 2);

    // Monthly goal line
    if (monthlyGoal > 0) {
      const goalLine = g.append('line')
        .attr('class', 'goal-line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(monthlyGoal))
        .attr('y2', yScale(monthlyGoal))
        .attr('stroke', '#ef4444') // Vermelho proeminente
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');

      // Goal line label
      g.append('text')
        .attr('x', innerWidth - 5)
        .attr('y', yScale(monthlyGoal) - 5)
        .attr('text-anchor', 'end')
        .attr('fill', 'hsl(var(--destructive))')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text(`Limite: R$ ${monthlyGoal.toLocaleString('pt-BR')}`);

      // Add hover effect to goal line
      goalLine
        .on('mouseover', function(event) {
          const formatCurrency = (amount: number) => {
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(amount);
          };
          
          tooltip
            .style('visibility', 'visible')
            .html(`
              <div>
                <strong>Limite Mensal</strong><br/>
                ${formatCurrency(monthlyGoal)}
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
    }

    // X Axis - Meses
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d => d.toString()))
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
      .style('z-index', '1000')
      .style('pointer-events', 'none');

    // Add hover and click effects
    g.selectAll('.income-bar, .expense-bar')
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d: any) {
        const formatCurrency = (amount: number) => {
          return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(amount);
        };

        const isIncome = d3.select(this).classed('income-bar');
        const value = isIncome ? d.income : d.expenses;
        const type = isIncome ? 'Entradas' : 'Saídas';
        
        tooltip
          .style('visibility', 'visible')
          .html(`
            <div>
              <strong>Mês: ${d.month}</strong><br/>
              ${type}: ${formatCurrency(value)}<br/>
              <span class="text-[10px] text-muted-foreground">Clique para detalhes</span>
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
      })
      .on('click', function(event, d: any) {
        if (onBarClick) {
          onBarClick(d.month);
        }
      });

    // Cleanup function
    return () => {
      d3.selectAll('.tooltip').remove();
    };
  }, [data, width, height, monthlyGoal]);

  return (
    <div className="w-full h-[350px] overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMinYMin meet"
        className="w-full h-full"
      />
    </div>
  );
}