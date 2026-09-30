import { useEffect } from 'react';

export function App() {
  useEffect(() => {
    window.__snapReady = true;
  }, []);

  return (
    <main className="flex h-full items-end p-16">
      <h1 className="text-heading-lg font-normal leading-[1.1] tracking-[-0.04em]">fly_ui</h1>
    </main>
  );
}
