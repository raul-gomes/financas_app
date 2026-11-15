interface ExtractTypeBadgeProps {
  type: 'income' | 'expense';
}

/** "Entrada" / "Saída" pill of a parsed transaction. */
export function ExtractTypeBadge({ type }: ExtractTypeBadgeProps) {
  const isIncome = type === 'income';
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
        isIncome ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
      }`}
    >
      {isIncome ? 'Entrada' : 'Saída'}
    </span>
  );
}
