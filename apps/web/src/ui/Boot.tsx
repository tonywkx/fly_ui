/** Holds the inline first paint (`.boot-mark` in index.html) while the app chunk loads. */
export function Boot() {
  return (
    <p className="boot-mark" aria-hidden="true">
      fly_ui
    </p>
  );
}
