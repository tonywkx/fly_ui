---
paths:
  - "apps/web/src/ui/**"
  - "apps/web/src/**/*.css"
---
UI work: DESIGN.md (visual reference) + PRODUCT.md (how it maps to this instrument) are the source of truth; PRODUCT.md wins on conflict.
- Tokens only from `apps/web/src/ui/theme.css` — no raw hex/px in components.
- Animate transform/opacity only; honor `prefers-reduced-motion`; UI motion via `motion/react`, camera/cinematics via GSAP.
- Components: shadcn/ui (Radix) base; Kokonut UI / Bklit UI via shadcn registry only when they fit PRODUCT.md.
- After a UI change: `ui-critic` agent. For motion details use the `animate` / `emil-design-eng` skills.
