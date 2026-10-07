import { Button } from '@/components/ui/button';

/** The dataset credit line (bottom right on desktop). */
export function Credit() {
  return (
    <p className="pointer-events-auto -mx-1 text-caption text-ash">
      <Button variant="ghost" asChild className="h-auto py-3 text-caption md:py-0">
        <a href="https://neuprint.janelia.org/" target="_blank" rel="noreferrer">
          male-cns v1.0 · Janelia FlyEM / neuPrint · CC BY 4.0
        </a>
      </Button>
    </p>
  );
}
