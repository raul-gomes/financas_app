# Flip Chart: Yearly to Daily Breakdown

## Summary

When the user clicks a month bar on the yearly chart, the chart flips like a coin (CSS 3D rotateY) and reveals a daily bar chart for that specific month showing income, expenses, and investment per day.

## Architecture

### Component Tree

```
FinancialDashboard
├── Cards (Pix, Credito, Debito)
├── FlippableChart (NEW)
│   ├── .flip-container (perspective: 1000px)
│   │   └── .flip-inner (transform-style: preserve-3d)
│   │       ├── .chart-front (backface-visibility: hidden)
│   │       │   └── D3BarChart (existing, unchanged)
│   │       └── .chart-back (backface-visibility: hidden, rotateY(180deg))
│   │           └── D3DailyChart (NEW)
│   └── Botao "Voltar" (visible when flipped)
├── IncomeChart (D3PieChart)
└── Category breakdown
```

### New Types

```typescript
// Daily data for chart
interface DailyData {
  day: number;       // 1-31
  income: number;
  expenses: number;
  investment: number;
}

// Selected month state
interface SelectedMonth {
  name: string;     // "Janeiro"
  index: number;    // 0-11
  year: number;
}
```

### New Components

#### FlippableChart
- **Props**: `yearlyData`, `dailyData`, `monthlyGoal`, `selectedMonth`, `onMonthClick`, `onBackClick`
- Renders the flip container with front (yearly) and back (daily) SVGs
- Manages CSS class `.is-flipped` on `.flip-inner`
- Shows/hides "Voltar" button based on state

#### D3DailyChart
- **Props**: `data: DailyData[]`, `width`, `height`, `selectedMonth: string`
- Renders a D3 SVG bar chart with:
  - X axis: day numbers 1..N (last day of month)
  - 3 bars per day: income (green), expenses (red), investment (yellow)
  - Same color scheme and bar width ratio as D3BarChart
  - Animated bar growth (height 0 -> final) synchronized with flip (600ms)
  - Stagger delay of 20ms between days
  - Tooltip on hover showing day number and values
  - Overflow-x auto for months with 31 days

### Data Flow

1. User clicks month bar on yearly chart
2. `onBarClick(monthName)` fires -> `FlippableChart` sets `selectedMonth`
3. CSS class `.is-flipped` added -> 600ms rotateY(180deg) animation starts
4. Simultaneously, `handleMonthSelect(monthIndex, year)` updates parent date range -> triggers data reload
5. `dailyData` is computed from `transactions` prop + `selectedMonth` info
   - Filter transactions by month/year
   - Group by day of month, summing income/expenses/investment
6. D3DailyChart starts rendering bars (height 0 -> full, 600ms, sync with flip)
7. When flip finishes, daily chart is fully visible with grown bars
8. "Voltar" button resets `selectedMonth` to null, reverses flip

### CSS Flip

```css
.flip-container {
  perspective: 1000px;
  width: 100%;
  height: 350px;
}

.flip-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.flip-inner.is-flipped {
  transform: rotateY(180deg);
}

.chart-front,
.chart-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
}

.chart-back {
  transform: rotateY(180deg);
}
```

### Daily Data Computation (in FinancialDashboard)

```typescript
const dailyData = useMemo(() => {
  if (!selectedMonth) return [];
  const daysInMonth = new Date(selectedMonth.year, selectedMonth.index + 1, 0).getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    income: 0,
    expenses: 0,
    investment: 0,
  }));

  transactions.forEach((t) => {
    const date = new Date(t.data_transacao);
    if (date.getMonth() === selectedMonth.index && date.getFullYear() === selectedMonth.year) {
      const dayIdx = date.getDate() - 1;
      if (t.tipo === 'entrada') days[dayIdx].income += t.valor;
      else if (t.tipo === 'saida') days[dayIdx].expenses += t.valor;
      else if (t.tipo === 'investimento') days[dayIdx].investment += t.valor;
    }
  });

  return days;
}, [transactions, selectedMonth]);
```

### Files Changed

| File | Action |
|------|--------|
| `frontend/src/components/FlippableChart.tsx` | CREATE |
| `frontend/src/components/D3DailyChart.tsx` | CREATE |
| `frontend/src/components/FinancialDashboard.tsx` | MODIFY |
| `frontend/src/pages/Financial.tsx` | MODIFY |
| `frontend/src/types/financial.ts` | MODIFY |
| `.gitignore` | MODIFY (add .superpowers/) |

### No Backend Changes

All daily data is computed client-side from the existing `transactions` prop, which is already fetched for the selected date range via `/dashboard/extrato`.
