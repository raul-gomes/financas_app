interface AnchorDef {
  id: string;
  label: string;
}

interface ChartAnchorsProps {
  items: AnchorDef[];
}

export function ChartAnchors({ items }: ChartAnchorsProps) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav aria-label="Seções do dashboard" className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => scrollTo(item.id)}
          className="px-3 py-1.5 text-xs font-medium rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-white transition-colors"
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}