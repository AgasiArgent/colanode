import { useEffect, useState } from 'react';

import { useApp } from '@colanode/ui/contexts/app';

const MOBILE_MAX_WIDTH = 768;
const mobileQuery = `(max-width: ${MOBILE_MAX_WIDTH - 1}px)`;

// User-agent sniffing alone misses iPad (iPadOS 13+ reports a desktop UA) and
// narrow desktop windows, so the primary signal is the viewport width. The UA
// regex is kept as an OR so a real phone stays "mobile" even in landscape.
const mobileUserAgentRegex =
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i;

const matchesMobileUserAgent = (): boolean =>
  typeof navigator !== 'undefined' &&
  mobileUserAgentRegex.test(navigator.userAgent);

export const useIsMobile = (): boolean => {
  const app = useApp();
  const [isNarrowViewport, setIsNarrowViewport] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(mobileQuery).matches
      : false
  );

  useEffect(() => {
    const mediaQueryList = window.matchMedia(mobileQuery);
    const handleChange = () => setIsNarrowViewport(mediaQueryList.matches);
    handleChange();
    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  if (app.type === 'mobile') {
    return true;
  }

  return isNarrowViewport || matchesMobileUserAgent();
};
