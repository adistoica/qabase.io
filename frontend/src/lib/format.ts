export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'passed':
    case 'completed':
      return 'badge badge-success';
    case 'failed':
    case 'aborted':
      return 'badge badge-destructive';
    case 'blocked':
      return 'badge badge-warning';
    case 'in_progress':
      return 'badge badge-info';
    case 'pending':
    case 'skipped':
    default:
      return 'badge';
  }
}

export function priorityClass(priority: string): string {
  switch (priority) {
    case 'P0':
      return 'badge badge-destructive';
    case 'P1':
      return 'badge badge-warning';
    case 'P2':
      return 'badge badge-info';
    case 'P3':
    default:
      return 'badge';
  }
}
