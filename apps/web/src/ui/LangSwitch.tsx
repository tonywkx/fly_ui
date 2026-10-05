import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { LANGS, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';

/** RU / EN: two mono ghost buttons, the current one lit (colour + underline, never hue alone). */
export const LangSwitch = observer(function LangSwitch({ className }: { className?: string }) {
  return (
    <fieldset
      aria-label={t('lang.switch')}
      className={cn('pointer-events-auto flex items-center', className)}
    >
      {LANGS.map((l) => (
        <Button
          key={l}
          lang={l}
          aria-pressed={app.lang === l}
          onClick={() => app.setLang(l)}
          className="h-8 px-1 font-mono text-caption text-ash decoration-bone/60 underline-offset-4 aria-pressed:text-bone aria-pressed:underline md:h-4"
        >
          {t(`lang.${l}`)}
        </Button>
      ))}
    </fieldset>
  );
});
