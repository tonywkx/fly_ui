import { observer } from 'mobx-react-lite';
import { type Key, t } from '@/i18n';
import type { Op, Outcome } from '@/scene/dish/verdict';
import { dish } from '@/state/dish';

const k = (op: Op, part: string) => `op.${op}.${part}` as Key;

export function nowLine(op: Op, o: Outcome | undefined): string {
  if (!o) return t('op.try', { hint: t(k(op, 'try')) });
  const line = op === 'panic' && o.line === 'verdict' && o.hit ? 'verdict_hit' : o.line;
  return t(k(op, line), { hz: o.hz, ms: o.ms ?? 0 });
}

/** The latest outcome of a free-play operation, announced from one live region. */
export const OpsStatus = observer(function OpsStatus() {
  const { last } = dish;
  return (
    <p role="status" className="sr-only">
      {last && `${t(k(last, 'name'))}: ${nowLine(last, dish.now[last])}`}
    </p>
  );
});
