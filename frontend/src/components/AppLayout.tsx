// src/components/AppLayout.tsx
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { DollarSign, BarChart3, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AppLayout() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'bg-primary text-white'
      : 'text-muted-foreground hover:bg-gray-100';

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-card shadow-elegant border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <NavLink to="/" className="text-2xl font-bold text-foreground">
            FinanceTracker
          </NavLink>
          <nav className="flex items-center gap-2">
            <NavLink to="/" className={linkClass}>
              <Button variant="ghost" size="sm" className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />Visão Geral
              </Button>
            </NavLink>
            <NavLink to="/financial" className={linkClass}>
              <Button variant="ghost" size="sm" className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />Financeiro
              </Button>
            </NavLink>
            <NavLink to="/investments" className={linkClass}>
              <Button variant="ghost" size="sm" className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />Investimentos
              </Button>
            </NavLink>
            <NavLink to="/limits" className={linkClass}>
              <Button variant="ghost" size="sm" className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />Limites
              </Button>
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
