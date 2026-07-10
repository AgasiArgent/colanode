import { useApp } from '@colanode/ui/contexts/app';

export const AppAssets = () => {
  const app = useApp();

  // Mobile loads fonts via Vite-inlined data: URIs (see apps/mobile MobileFonts)
  // because the React Native WebView can't resolve the local:// scheme that the
  // Electron desktop app uses. Emitting the local:// @font-face here too would
  // just produce failing requests, so skip it on mobile.
  if (app.type === 'mobile') {
    return null;
  }

  const fontPrefix = app.type === 'web' ? `/assets/fonts` : `local://fonts`;

  return (
    <style>{`
      @font-face {
        font-family: "Bricolage Grotesque";
        src: url('${fontPrefix}/bricolage-grotesque-variable.woff2') format("woff2-variations"),
            url('${fontPrefix}/bricolage-grotesque-variable.woff2') format("woff2");
        font-weight: 400 800;
        font-style: normal;
        font-display: swap;
      }

      @font-face {
        font-family: "Karla";
        src: url('${fontPrefix}/karla-variable.woff2') format("woff2-variations"),
            url('${fontPrefix}/karla-variable.woff2') format("woff2");
        font-weight: 400 700;
        font-style: normal;
        font-display: swap;
      }

      @font-face {
        font-family: "Karla";
        src: url('${fontPrefix}/karla-italic.woff2') format("woff2");
        font-weight: 400;
        font-style: italic;
        font-display: swap;
      }

      @font-face {
        font-family: "Spline Sans Mono";
        src: url('${fontPrefix}/spline-sans-mono-variable.woff2') format("woff2-variations"),
            url('${fontPrefix}/spline-sans-mono-variable.woff2') format("woff2");
        font-weight: 300 700;
        font-style: normal;
        font-display: swap;
      }
    `}</style>
  );
};
