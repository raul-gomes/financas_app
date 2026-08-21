import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/format';
import * as d3 from 'd3';
import { DailyData } from '@/types/financial';

interface D3DailyChartProps {
  data: DailyData[];
  width?: number;
  height?: number;
  selectedMonth?: string;
  monthlyGoal?: number;
}

export function D3DailyChart({
  data,
  width = 900,
  height = 420,
  selectedMonth = '',
  monthlyGoal = 0,
}: D3DailyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width, height });

  // ResizeObserver to make the chart responsive
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      setDims({ width: Math.round(w), height: Math.round(h) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous chart

    const margin = { top: 24, right: 0, left: 72, bottom: 48 };
    const innerWidth = dims.width - margin.left - margin.right;
    const innerHeight = dims.height - margin.top - margin.bottom;

    // Scales
    const xScale = d3.scaleBand()
      .domain(data.map(d => d.day.toString()))
      .range([0, innerWidth])
      .padding(0.3);

    const rawMax = d3.max(data, d => Math.max(d.income, d.expenses, d.investment)) || 0;
    const effectiveMax = Math.max(rawMax, monthlyGoal || 0);
    const maxValue = Math.max(effectiveMax, 1);
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
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'income-bar')
      .attr('x', d => xScale(d.day.toString())! + (xScale.bandwidth() / 3) * 0 + 1)
      .attr('width', (xScale.bandwidth() / 3) - 2)
      .attr('fill', 'hsl(var(--success))')
      .attr('rx', 3)
      .attr('y', innerHeight)
      .attr('height', 0)
      .transition()
      .delay((_, i) => i * 10)
      .duration(400)
      .ease(d3.easeBackOut)
      .attr('y', d => yScale(d.income))
      .attr('height', d => innerHeight - yScale(d.income));

    // Expense bars (red) - animated
    g.selectAll('.expense-bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'expense-bar')
      .attr('x', d => xScale(d.day.toString())! + (xScale.bandwidth() / 3) * 1 + 1)
      .attr('width', (xScale.bandwidth() / 3) - 2)
      .attr('fill', 'hsl(var(--destructive))')
      .attr('rx', 3)
      .attr('y', innerHeight)
      .attr('height', 0)
      .transition()
      .delay((_, i) => i * 10 + 20)
      .duration(400)
      .ease(d3.easeBackOut)
      .attr('y', d => yScale(d.expenses))
      .attr('height', d => {
        const h = innerHeight - yScale(d.expenses);
        return h > 2 ? h : 2;
      });

    // Investment bars (yellow) - animated
    g.selectAll('.investment-bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'investment-bar')
      .attr('x', d => xScale(d.day.toString())! + (xScale.bandwidth() / 3) * 2 + 1)
      .attr('width', (xScale.bandwidth() / 3) - 2)
      .attr('fill', 'hsl(var(--warning))')
      .attr('rx', 3)
      .attr('y', innerHeight)
      .attr('height', 0)
      .transition()
      .delay((_, i) => i * 10 + 40)
      .duration(400)
      .ease(d3.easeBackOut)
      .attr('y', d => yScale(d.investment))
      .attr('height', d => {
        const h = innerHeight - yScale(d.investment);
        return h > 2 ? h : 2;
      });

    // X Axis - Day numbers
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d => d.toString()))
      .selectAll('text')
      .attr('fill', 'hsl(var(--muted-foreground))')
      .style('font-size', '12px');

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => {
        const value = Number(d);
        if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
        return value.toString();
      }))
      .selectAll('text')
      .attr('fill', 'hsl(var(--muted-foreground))')
      .style('font-size', '13px');

    // Remove axis lines (clean look)
    g.selectAll('.domain').remove();
    g.selectAll('.tick line').remove();

    // Monthly goal line
    if (monthlyGoal > 0) {
      const goalY = yScale(monthlyGoal);
      g.append('line')
        .attr('class', 'goal-line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', goalY)
        .attr('y2', goalY)
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');

      g.append('text')
        .attr('x', innerWidth - 5)
        .attr('y', goalY - 5)
        .attr('text-anchor', 'end')
        .attr('fill', 'hsl(var(--destructive))')
        .style('font-size', '13px')
        .style('font-weight', 'bold')
        .text(`Meta: R$ ${monthlyGoal.toLocaleString('en-US')}`);
    }

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip-daily')
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

    // Hover effects
    g.selectAll('.income-bar, .expense-bar, .investment-bar')
      .style('cursor', 'default')
      .on('mouseover', function (event, d: any) {
        const isIncome = d3.select(this).classed('income-bar');
        const isExpense = d3.select(this).classed('expense-bar');
        const isInvestment = d3.select(this).classed('investment-bar');
        let value = 0;
        let type = '';
        if (isIncome) { value = d.income; type = 'Income'; }
        else if (isExpense) { value = d.expenses; type = 'Expenses'; }
        else if (isInvestment) { value = d.investment; type = 'Investments'; }

        tooltip
          .style('visibility', 'visible')
          .html(`
            <div>
              <strong>Dia ${d.day}/${selectedMonth?.split(' ')[0] || ''}</strong><br/>
              ${type}: ${formatCurrency(value)}
            </div>
          `);
      })
      .on('mousemove', function (event) {
        tooltip
          .style('top', event.pageY - 10 + 'px')
          .style('left', event.pageX + 10 + 'px');
      })
      .on('mouseout', function () {
        tooltip.style('visibility', 'hidden');
      });

    // Cleanup
    return () => {
      d3.selectAll('.tooltip-daily').remove();
    };
  }, [data, dims, selectedMonth, monthlyGoal]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-muted-foreground text-sm">
        Nenhum dado disponível para {selectedMonth || 'este período'}.
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="absolute inset-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        preserveAspectRatio="xMinYMin meet"
        className="w-full h-full"
        style={{ overflow: 'visible' }}
      />
    </div>
  );
}
