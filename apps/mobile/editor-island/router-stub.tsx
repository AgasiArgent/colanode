import React from 'react';

// Minimal stand-in for `@tanstack/react-router`, aliased in only by
// vite.editor.config.ts. The editor island mounts the shared `Document`
// component, whose only router coupling is `FileBlock`'s `<Link>` (via
// @colanode/ui/components/ui/link, which calls `createLink`) and a couple of
// `useNavigate` call sites that never fire inside the document viewport.
//
// This exposes exactly the surface those components reference. Extend it (do
// NOT pull in the real router) if another transitively-mounted component needs
// more — the Vite build fails loudly on an unresolved named export.

export const Link = ({
  children,
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => <span>{children}</span>;

// `createLink` wraps a component in the real router; here it is an identity
// passthrough so @colanode/ui/components/ui/link renders a plain anchor.
export const createLink = <TComponent,>(component: TComponent): TComponent =>
  component;

export type LinkComponent<TComponent> = TComponent;

export const useNavigate = () => () => undefined;

export const useLocation = () => ({ pathname: '' });

// `node-delete-dialog` (reachable through the editor's node blocks) reads
// `router.state.matches` and calls `router.navigate` only from its delete
// handler, which never fires inside the read/edit island. An inert router with
// the shape those call sites touch keeps the bundle resolvable.
export const useRouter = () => ({
  state: { matches: [] as unknown[] },
  navigate: (_options?: unknown) => undefined,
});
