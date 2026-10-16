import { observer } from 'mobx-react-lite';
import { t } from '@/i18n';
import { cellKey } from '@/ui/cellKey';

/** A cell's plain name first, its type after it in mono («нейрон бегства · DNp01»); unnamed → the type. */
export const CellName = observer(function CellName({ type }: { type: string | null }) {
  const key = cellKey(type);
  if (!key) return type ?? t('neuron.untyped');
  return (
    <>
      {t(key)} <span className="font-mono text-mist">· {type}</span>
    </>
  );
});
