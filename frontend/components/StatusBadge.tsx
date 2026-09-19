interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusColor = (s: string) => {
    const lower = s.toLowerCase();
    if (['running', 'completed', 'resolved', 'healthy', 'low', 'ready'].includes(lower)) return 'bg-green-100 text-green-800';
    if (['paused', 'retrying', 'warning', 'moderate', 'medium'].includes(lower)) return 'bg-yellow-100 text-yellow-800';
    if (['cancelled', 'escalated', 'critical', 'high', 'unhealthy'].includes(lower)) return 'bg-red-100 text-red-800';
    if (['calling', 'info'].includes(lower)) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800'; // pending, draft, routine, manual follow-up
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${getStatusColor(status)}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
