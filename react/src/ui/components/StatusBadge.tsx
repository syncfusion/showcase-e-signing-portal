import { CheckCircle2, Clock, PenLine } from 'lucide-react';
import type { Badge } from '../../domain/types';

const BADGES: Record<Badge, { label: string; tone: string; Icon: typeof Clock }> = {
  ready: { label: 'Ready to sign', tone: 'info', Icon: PenLine },
  'due-soon': { label: 'Due soon', tone: 'warning', Icon: Clock },
  completed: { label: 'Completed', tone: 'success', Icon: CheckCircle2 },
};

/** Status tone plus an icon and a label, so the meaning never rests on colour alone. */
export function StatusBadge({ badge }: { badge: Badge }) {
  const { label, tone, Icon } = BADGES[badge];
  return <span className={`status-badge tone-${tone}`} data-badge={badge}><Icon size={13} aria-hidden="true" />{label}</span>;
}