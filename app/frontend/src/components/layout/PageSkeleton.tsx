import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback de carregamento para rotas com code-splitting (React.lazy).
 * Exibido pelo <Suspense> em App.tsx enquanto o chunk da rota baixa.
 */
export function PageSkeleton() {
  return (
    <div className="p-6 space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}
