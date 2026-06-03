import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { DailyData } from '@/types/financial';

interface D3DailyChartProps {
  data: DailyData[];
  width?: number;
  height?: number;
  selectedMonth?: string;
}

export function D3DailyChart({
  data,
  width = 900,
  height = 350,
  selectedMonth = '',
}: D3DailyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, left: 60, bottom: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const xScale = d3.scaleBand()
      .domain(data.map((d) => String(d.day)))
      .range([0, innerWidth])
      .padding(0.2);

    const maxValue = d3.max(data, (d) => Math.max(d.income, d.expenses, d.investment)) || 0;
    const yScale = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .range([innerHeight, 0]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Grid lines
    g.selectAll('.grid-line')
      .data(yScale.ticks(6))
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', 'hsl(var(--border))')
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.3);

    const bandwidth = xScale.bandwidth();
    const barWidth = Math.max((bandwidth / 3) - 3, 2);

    // Income bars
    g.selectAll('.income-bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'income-bar')
      .attr('x', (d) => xScale(String(d.day))! + bandwidth * 0)
      .attr('width', barWidth)
      .attr('fill', 'hsl(var(--success))')
      .attr('rx', 2)
      .attr('y', innerHeight)
      .attr('height', 0)
      .transition()
      .delay((_, i) => i * 20)
      .duration(600)
      .ease(d3.easeBackOut.overshoot(0.5))
      .attr('y', (d) => yScale(d.income))
      .attr('height', (d) => innerHeight - yScale(d.income));

    // Expense bars
    g.selectAll('.expense-bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'expense-bar')
      .attr('x', (d) => xScale(String(d.day))! + bandwidth * 1 / 3)
      .attr('width', barWidth)
      .attr('fill', 'hsl(var(--destructive))')
      .attr('rx', 2)
      .attr('y', innerHeight)
      .attr('height', 0)
      .transition()
      .delay((_, i) => i * 20 + 8)
      .duration(600)
      .ease(d3.easeBackOut.overshoot(0.5))
      .attr('y', (d) => yScale(d.expenses))
      .attr('height', (d) => {
        const h = innerHeight - yScale(d.expenses);
        return h > 2 ? h : 2;
      });

    // Investment bars
    g.selectAll('.investment-bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'investment-bar')
      .attr('x', (d) => xScale(String(d.day))! + bandwidth * 2 / 3)
      .attr('width', barWidth)
      .attr('fill', 'hsl(var(--warning))')
      .attr('rx', 2)
      .attr('y', innerHeight)
      .attr('height', 0)
      .transition()
      .delay((_, i) => i * 20 + 16)
      .duration(600)
      .ease(d3.easeBackOut.overshoot(0.5))
      .attr('y', (d) => yScale(d.investment))
      .attr('height', (d) => {
        const h = innerHeight - yScale(d.investment);
        return h > 2 ? h : 2;
      });

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat((d) => d.toString()))
      .selectAll('text')
      .attr('fill', 'hsl(var(--muted-foreground))')
      .style('font-size', '10px');

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

    // Hover/click on bars
    g.selectAll('.income-bar, .expense-bar, .investment-bar')
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d: any) {
        const formatCurrency = (amount: number) =>
          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

        const isIncome = d3.select(this).classed('income-bar');
        const isExpense = d3.select(this).classed('expense-bar');
        const isInvestment = d3.select(this).classed('investment-bar');

        let value = 0;
        let type = '';
        if (isIncome) { value = d.income; type = 'Entradas'; }
        else if (isExpense) { value = d.expenses; type = 'Saidas'; }
        else if (isInvestment) { value = d.investment; type = 'Investimento'; }

        tooltip
          .style('visibility', 'visible')
          .html(`
            <div>
              <strong>${selectedMonth} - Dia ${d.day}</strong><br/>
              ${type}: ${formatCurrency(value)}<br/>
              <span class="text-[10px] text-muted-foreground">Ferramenta</span>
            </div>
          `);
      })
      .on('mousemove', function (event) {
        tooltip
          .style('top', `${event.pageY - 10}px`)
          .style('left', `${event.pageX + 10}px`);
      })
      .on('mouseout', function () {
        tooltip.style('visibility', 'hidden');
      });

    return () => {
      d3.selectAll('.tooltip').remove();
    };
  }, [data, width, height, selectedMonth]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[350px] text-muted-foreground">
        Nenhum dado disponivel para este mes.
      </div>
    );
  }

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
