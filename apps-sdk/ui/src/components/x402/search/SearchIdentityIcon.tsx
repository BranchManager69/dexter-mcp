import { useMemo, useState } from 'react';
import type { SearchResource } from './types';
import { hostLabel, resourceIconUrl } from './utils';

export function SearchIdentityIcon({ resource, size = 44 }: { resource: SearchResource; size?: number }) {
  const src = useMemo(() => resourceIconUrl(resource), [resource]);
  const [failed, setFailed] = useState(false);
  const label = hostLabel(resource.url).slice(0, 1).toUpperCase() || '?';

  if (!src || failed) {
    return (
      <div
        className="flex items-center justify-center rounded-[18px] border border-subtle bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] text-sm font-semibold text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {label}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="rounded-[18px] border border-subtle bg-surface-secondary object-cover shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
      aria-hidden="true"
    />
  );
}
