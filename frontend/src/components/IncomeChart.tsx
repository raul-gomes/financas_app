// src/components/IncomeChart.tsx

import { useMemo } from 'react'
import { D3PieChart } from './D3PieChart'
import { Card } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import { CategoryBreakdown } from '@/types/financial'

interface IncomeChartProps {
  breakdown: CategoryBreakdown | null
  dateRange: { from: Date; to: Date }
}


export function IncomeChart({ breakdown }: IncomeChartProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount)

  const incomeData = useMemo(() => {
    if (!breakdown?.categorias?.length) {
      return { chartData: [], total: 0, count: 0 }
    }

    const chartData = breakdown.categorias.map((cat, idx) => ({
      category: cat.nome,
      value: cat.total,
      color: `hsl(${120 + (idx * 60) % 240},65%,55%)`
    }))

    const total = breakdown.categorias.reduce((sum, cat) => sum + cat.total, 0)
    const count = breakdown.categorias.length

    return { chartData, total, count }
  }, [breakdown])

  if (incomeData.chartData.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-success" />
          <h3 className="text-lg font-semibold">Entradas do Período</h3>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhuma entrada encontrada no período selecionado</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-success" />
        <h3 className="text-lg font-semibold">Entradas do Período</h3>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Total de Entradas:</span>
        <span className="text-lg font-bold text-success">
          {formatCurrency(incomeData.total)}
        </span>
      </div>

      <div className="w-full flex justify-center mb-6">
        <div className="inline-block">
          <D3PieChart data={incomeData.chartData} width={350} height={280} />
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground mb-3">
          Detalhamento por Categoria:
        </h4>
        {incomeData.chartData.map((cat, idx) => (
          <div
            key={cat.category}
            className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-sm font-medium">{cat.category}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold">
                {formatCurrency(cat.value)}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                ({((cat.value / incomeData.total) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
