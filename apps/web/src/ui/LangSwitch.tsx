import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { LANGS, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';

/**
 * RU / EN: two mono ghost buttons, the current one lit (colour + underline, never hue alone).
 * `compact` (phone ViewerBar, where width is short): one button naming the other language.
 */
export const LangSwitch = observer(function LangSwitch({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    const other = app.lang === 'ru' ? 'en' : 'ru';
    return (
      <Button
        lang={other}
        aria-label={t('lang.to')}
        onClick={() => app.setLang(other)}
        className={cn('pointer-events-auto h-8 px-1.5 font-mono text-caption text-ash', className)}
      >
        {t(`lang.${other}`)}
      </Button>
    );
  }
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
          className="h-4 px-1 font-mono text-caption text-ash decoration-bone/60 underline-offset-4 aria-pressed:text-bone aria-pressed:underline"
        >
          {t(`lang.${l}`)}
        </Button>
      ))}
    </fieldset>
  );
});
