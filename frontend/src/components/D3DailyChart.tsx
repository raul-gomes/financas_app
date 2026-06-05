import { useEffect, useRef, useState } from 'react';
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
  height = 380,
  selectedMonth = '',
  monthlyGoal = 0,
}: D3DailyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

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
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 24, left: 64, bottom: 48 };
    const innerWidth = dims.width - margin.left - margin.right;
    const innerHeight = dims.height - margin.top - margin.bottom;

    const xScale = d3.scaleBand()
      .domain(data.map((d) => d.day.toString()))
      .range([0, innerWidth])
      .padding(0.15);

    const maxValue = d3.max(data, (d) => Math.max(d.income, d.expenses, d.investment)) || 0;
    const yScale = d3.scaleLinear()
      .domain([0, maxValue * 1.15])
      .range([innerHeight, 0]);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Grid lines
    g.selectAll('.grid-line')
      .data(yScale.ticks(5))
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', 'hsl(var(--border))')
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.25);

    // Income bars
    g.selectAll('.income-bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'income-bar')
      .attr('x', (d) => xScale(d.day.toString())! + (xScale.bandwidth() / 3) * 0 + 1)
      .attr('width', (xScale.bandwidth() / 3) - 2)
      .attr('fill', 'hsl(var(--success))')
      .attr('rx', 2)
      .attr('y', innerHeight)
      .attr('height', 0)
      .transition()
      .delay((_, i) => i * 10)
      .duration(400)
      .ease(d3.easeBackOut)
      .attr('y', (d) => yScale(d.income))
      .attr('height', (d) => innerHeight - yScale(d.income));

    // Expense bars
    g.selectAll('.expense-bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'expense-bar')
      .attr('x', (d) => xScale(d.day.toString())! + (xScale.bandwidth() / 3) * 1 + 1)
      .attr('width', (xScale.bandwidth() / 3) - 2)
      .attr('fill', 'hsl(var(--destructive))')
      .attr('rx', 2)
      .attr('y', innerHeight)
      .attr('height', 0)
      .transition()
      .delay((_, i) => i * 10 + 20)
      .duration(400)
      .ease(d3.easeBackOut)
      .attr('y', (d) => yScale(d.expenses))
      .attr('height', (d) => innerHeight - yScale(d.expenses));

    // Investment bars
    g.selectAll('.investment-bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'investment-bar')
      .attr('x', (d) => xScale(d.day.toString())! + (xScale.bandwidth() / 3) * 2 + 1)
      .attr('width', (xScale.bandwidth() / 3) - 2)
      .attr('fill', 'hsl(var(--warning))')
      .attr('rx', 2)
      .attr('y', innerHeight)
      .attr('height', 0)
      .transition()
      .delay((_, i) => i * 10 + 40)
      .duration(400)
      .ease(d3.easeBackOut)
      .attr('y', (d) => yScale(d.investment))
      .attr('height', (d) => innerHeight - yScale(d.investment));

    // X Axis (day numbers)
    const xAxis = d3.axisBottom(xScale)
      .tickValues(
        data.filter((_, i) => {
          const totalDays = data.length;
          if (totalDays <= 15) return true;
          if (totalDays <= 20) return i % 2 === 0 || i === totalDays - 1;
          if (totalDays <= 25) return i % 3 === 0 || i === totalDays - 1;
          return i % 5 === 0 || i === totalDays - 1;
        }).map((d) => d.day.toString())
      );

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', 'hsl(var(--muted-foreground))')
      .style('font-size', '11px');

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => {
        if (d >= 1000) return `${(d / 1000).toFixed(1)}k`;
        return d.toString();
      }))
      .selectAll('text')
      .attr('fill', 'hsl(var(--muted-foreground))')
      .style('font-size', '11px');

    // Remove axis lines
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

      // Goal line label
      g.append('text')
        .attr('x', innerWidth - 5)
        .attr('y', goalY - 5)
        .attr('text-anchor', 'end')
        .attr('fill', 'hsl(var(--destructive))')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .text(`Meta: R$ ${monthlyGoal.toLocaleString('pt-BR')}`);
    }

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
      .style('pointer-events', 'none')
      .style('max-width', '90vw');

    g.selectAll('.income-bar, .expense-bar, .investment-bar')
      .style('cursor', 'default')
      .on('mouseover', function (event, d: any) {
        const formatCurrency = (amount: number) =>
          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

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

    return () => {
      d3.selectAll('.tooltip').remove();
    };
  }, [data, dims, selectedMonth, monthlyGoal]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-muted-foreground text-sm">
        Nenhum dado disponível para {selectedMonth || 'este período'}.
      </div>
    );
  }

  if (dims.width === 0 || dims.height === 0) {
    return <div ref={wrapperRef} className="w-full h-full" />;
  }

  return (
    <div ref={wrapperRef} className="w-full h-full">
      <svg
        ref={svgRef}
        width={dims.width}
        height={dims.height}
        className="block"
      />
    </div>
  );
}
