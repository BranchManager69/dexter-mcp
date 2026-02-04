import { useOpenAIGlobal } from './use-openai-global';
import type { UserAgent, DeviceType } from './types';

/**
 * Hook for accessing user agent information (device type, capabilities).
 */
export function useUserAgent(): UserAgent | null {
  return useOpenAIGlobal('userAgent') as UserAgent | null;
}

/**
 * Hook for getting the device type.
 */
export function useDeviceType(): DeviceType {
  const userAgent = useUserAgent();
  return userAgent?.device?.type ?? 'unknown';
}

/**
 * Hook for checking if the device supports touch.
 */
export function useIsTouch(): boolean {
  const userAgent = useUserAgent();
  return userAgent?.capabilities?.touch ?? false;
}

/**
 * Hook for checking if the device supports hover.
 */
export function useHasHover(): boolean {
  const userAgent = useUserAgent();
  return userAgent?.capabilities?.hover ?? true;
}

/**
 * Hook for checking if we're on mobile.
 */
export function useIsMobile(): boolean {
  const deviceType = useDeviceType();
  return deviceType === 'mobile';
}
