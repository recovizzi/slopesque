// A titled part of the ?kit page.
import type { ReactNode } from 'react';

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h2>{title}</h2>
    {children}
  </section>
);
