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
    <nav aria-label="Seções do dashboard" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => scrollTo(item.id)}
          className="shrink-0 px-3 py-1.5 text-xs font-medium max-md:min-h-[44px] max-md:px-4 max-md:text-sm rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}