import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { YearlyData } from '@/types/financial';

interface D3BarChartProps {
  data: YearlyData[];
  width?: number;
  height?: number;
  monthlyGoal?: number;
  selectedMonth?: string | null;
  onBarClick?: (month: string) => void;
}

export function D3BarChart({ 
  data, 
  width = 900, 
  height = 420, 
  monthlyGoal = 0,
  selectedMonth = null,
  onBarClick
}: D3BarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width, height });

  // ResizeObserver to make the chart responsive
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const h = Math.max(w * 0.48, 300);
      setDims({ width: Math.round(w), height: Math.round(h) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous chart

    const margin = { top: 24, right: 36, left: 72, bottom: 48 };
    const innerWidth = dims.width - margin.left - margin.right;
    const innerHeight = dims.height - margin.top - margin.bottom;

    // Use data as is
    const processedData = data;

    // Scales
    const xScale = d3.scaleBand()
      .domain(processedData.map(d => d.month))
      .range([0, innerWidth])
      .padding(0.3);

    const maxValue = d3.max(processedData, d => Math.max(d.income, d.expenses, d.investment, monthlyGoal)) || 0;
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

    // Income bars (green) - animated
    g.selectAll('.income-bar')
      .data(processedData)
      .enter()
      .append('rect')
      .attr('class', 'income-bar')
      .attr('x', d => xScale(d.month)! + (xScale.bandwidth() / 3) * 0 + 2)
      .attr('width', (xScale.bandwidth() / 3) - 4)
      .attr('fill', 'hsl(var(--success))')
      .attr('rx', 3)
      .attr('opacity', d => selectedMonth && d.month !== selectedMonth ? 0.5 : 1)
      // Start at bottom
      .attr('y', innerHeight)
      .attr('height', 0)
      // Transition up
      .transition()
      .delay((d, i) => i * 80)
      .duration(600)
      .ease(d3.easeElasticOut.amplitude(0.5).period(0.3))
      .attr('y', d => yScale(d.income))
      .attr('height', d => innerHeight - yScale(d.income));

    // Expense bars (red) - animated
    g.selectAll('.expense-bar')
      .data(processedData)
      .enter()
      .append('rect')
      .attr('class', 'expense-bar')
      .attr('x', d => xScale(d.month)! + (xScale.bandwidth() / 3) * 1 + 2)
      .attr('width', (xScale.bandwidth() / 3) - 4)
      .attr('fill', 'hsl(var(--destructive))')
      .attr('rx', 3)
      .attr('opacity', d => selectedMonth && d.month !== selectedMonth ? 0.5 : 1)
      // Start at bottom
      .attr('y', innerHeight)
      .attr('height', 0)
      // Transition up
      .transition()
      .delay((d, i) => i * 80 + 30)
      .duration(600)
      .ease(d3.easeElasticOut.amplitude(0.5).period(0.3))
      .attr('y', d => yScale(d.expenses))
      .attr('height', d => {
        const h = innerHeight - yScale(d.expenses);
        return h > 2 ? h : 2;
      });

    // Investment bars (yellow) - animated
    g.selectAll('.investment-bar')
      .data(processedData)
      .enter()
      .append('rect')
      .attr('class', 'investment-bar')
      .attr('x', d => xScale(d.month)! + (xScale.bandwidth() / 3) * 2 + 2)
      .attr('width', (xScale.bandwidth() / 3) - 4)
      .attr('fill', 'hsl(var(--warning))')
      .attr('rx', 3)
      .attr('opacity', d => selectedMonth && d.month !== selectedMonth ? 0.5 : 1)
      // Start at bottom
      .attr('y', innerHeight)
      .attr('height', 0)
      // Transition up
      .transition()
      .delay((d, i) => i * 80 + 60)
      .duration(600)
      .ease(d3.easeElasticOut.amplitude(0.5).period(0.3))
      .attr('y', d => yScale(d.investment))
      .attr('height', d => {
        const h = innerHeight - yScale(d.investment);
        return h > 2 ? h : 2;
      });

    // Monthly goal line
    if (monthlyGoal > 0) {
      const goalLine = g.append('line')
        .attr('class', 'goal-line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(monthlyGoal))
        .attr('y2', yScale(monthlyGoal))
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');

      // Goal line label
      g.append('text')
        .attr('x', innerWidth - 5)
        .attr('y', yScale(monthlyGoal) - 5)
        .attr('text-anchor', 'end')
        .attr('fill', 'hsl(var(--destructive))')
        .style('font-size', '13px')
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
      .style('font-size', '14px');

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => {
        if (d >= 1000) return `${(d / 1000).toFixed(0)}k`;
        return d.toString();
      }))
      .selectAll('text')
      .attr('fill', 'hsl(var(--muted-foreground))')
      .style('font-size', '13px');

    // Remove axis lines
    g.selectAll('.domain').remove();
    g.selectAll('.tick line').remove();

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'hsl(var(--card))')
      .style('border', '1px solid hsl(var(--border))')
      .style('border-radius', '8px')
      .style('padding', '10px')
      .style('font-size', '13px')
      .style('box-shadow', '0 4px 6px -1px rgb(0 0 0 / 0.1)')
      .style('z-index', '1000')
      .style('pointer-events', 'none')
      .style('max-width', '90vw');

    // Add hover and click effects
    g.selectAll('.income-bar, .expense-bar, .investment-bar')
      .style('cursor', 'pointer')
        .on('mouseover', function(event, d: any) {
          const formatCurrency = (amount: number) => {
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(amount);
          };

          const isIncome = d3.select(this).classed('income-bar');
          const isExpense = d3.select(this).classed('expense-bar');
          const isInvestment = d3.select(this).classed('investment-bar');
          let value = 0;
          let type = '';
          if (isIncome) { value = d.income; type = 'Entradas'; }
          else if (isExpense) { value = d.expenses; type = 'Saídas'; }
          else if (isInvestment) { value = d.investment; type = 'Investimento'; }
          
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
  }, [data, dims, monthlyGoal, selectedMonth]);

  return (
    <div ref={wrapperRef} className="w-full min-h-[300px]" style={{ height: '100%' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        preserveAspectRatio="xMinYMin meet"
        className="w-full h-full"
      />
    </div>
  );
}
