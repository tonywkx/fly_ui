import { observer } from 'mobx-react-lite';
import { type KeyboardEvent, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { type Key, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { dish, TABS, type Tab } from '@/state/dish';
import { OpsList } from './DishOps';
import { HandButtons, ItemButtons, type PaletteInput, Puppet } from './DishPalette';

const LABEL: Record<Tab, Key> = { items: 'dish.items', ops: 'op.title', puppet: 'puppet.title' };

/**
 * The phone's Terrarium controls (TERRARIUM-SHAPE §Phone, 8.14): three ghost-word tabs over one
 * panel — things + hands, the neurosurgeon's cards, the puppet keys. Sits above the wordmark.
 */
export const DishSheet = observer(function DishSheet({
  input,
  onClearBrain,
}: {
  input: PaletteInput;
  onClearBrain: () => void;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = TABS.indexOf(dish.tab);
  const step = (e: KeyboardEvent) => {
    const n = TABS.length;
    const go: Record<string, number> = {
      ArrowRight: (at + 1) % n,
      ArrowLeft: (at - 1 + n) % n,
      Home: 0,
      End: n - 1,
    };
    const next = go[e.key];
    if (next === undefined) return;
    e.preventDefault();
    dish.setTab(TABS[next] as Tab);
    tabs.current[next]?.focus();
  };
  const hint = dish.hand ? t(`dish.hand.tap.${dish.hand}`) : t('dish.hint.tap');

  return (
    <div className="pointer-events-none flex flex-col gap-2 pb-2 md:hidden">
      <div className="min-h-0">
        {dish.tab === 'items' && (
          <div
            role="tabpanel"
            id="sheet-items"
            aria-labelledby="sheet-items-tab"
            className="flex flex-col items-center gap-2"
          >
            <div className="flex items-center gap-2">
              <p className="text-center text-caption text-balance text-ash">{hint}</p>
              {!dish.empty && (
                <Button
                  className="pointer-events-auto h-8 px-2 text-caption text-mist"
                  onClick={() => input.reset()}
                >
                  {t('dish.reset')}
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <section aria-label={t('dish.items')} className="flex gap-1">
                <ItemButtons input={input} />
              </section>
              <section aria-label={t('dish.hands')} className="flex gap-1">
                <HandButtons input={input} />
              </section>
            </div>
          </div>
        )}
        {dish.tab === 'ops' && (
          <div
            role="tabpanel"
            id="sheet-ops"
            aria-labelledby="sheet-ops-tab"
            className="pointer-events-auto flex max-h-[42svh] [@media(max-height:759px)]:max-h-[38svh] flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-xl bg-card p-2 backdrop-blur-md"
          >
            <OpsList onClearBrain={onClearBrain} at="sheet-op" compact />
          </div>
        )}
        {dish.tab === 'puppet' && (
          <div
            role="tabpanel"
            id="sheet-puppet"
            aria-labelledby="sheet-puppet-tab"
            className="flex flex-col items-center gap-2"
          >
            <p className="text-center text-caption text-balance text-ash">{t('puppet.hint.tap')}</p>
            <div className="pointer-events-auto">
              <Puppet phone />
            </div>
          </div>
        )}
      </div>
      <div role="tablist" aria-label={t('dish.controls')} className="flex items-center justify-center">
        {TABS.map((tab, i) => (
          <span key={tab} className="flex items-center">
            {i > 0 && (
              <span aria-hidden className="px-0.5 text-caption text-ash">
                ·
              </span>
            )}
            <Button
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              id={`sheet-${tab}-tab`}
              aria-selected={dish.tab === tab}
              // only the selected tab's panel is mounted
              aria-controls={dish.tab === tab ? `sheet-${tab}` : undefined}
              tabIndex={dish.tab === tab ? 0 : -1}
              className={cn(
                'pointer-events-auto h-8 px-2 text-caption text-ash aria-selected:text-bone',
                // what's on in a hidden tab still shows: a saffron dot
                tab === 'ops' && dish.ops.size > 0 && dish.tab !== 'ops' && 'gap-1.5',
              )}
              onClick={() => dish.setTab(tab)}
              onKeyDown={step}
            >
              {t(LABEL[tab])}
              {tab === 'ops' && dish.ops.size > 0 && dish.tab !== 'ops' && (
                <>
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-saffron" />
                  <span className="sr-only">{t('op.active')}</span>
                </>
              )}
            </Button>
          </span>
        ))}
      </div>
    </div>
  );
});
