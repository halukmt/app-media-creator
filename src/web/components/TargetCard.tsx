import { useId, useState } from 'react';
import type { CatalogueDevice } from '../api';
import { en } from '../i18n/en';
import { FieldError } from './FieldError';
import { RequiredBadge } from './RequiredBadge';

interface Props {
  title: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  devices: readonly CatalogueDevice[];
  selected: readonly string[];
  onSelectedChange: (next: string[]) => void;
  error?: string;
}

/**
 * One store target on the Project screen: an enabled switch and its device models. Required and initially selected
 * devices are listed first; the rest sit in a "More devices" collapse. A disabled target keeps its device selection.
 */
export function TargetCard({ title, enabled, onEnabledChange, devices, selected, onSelectedChange, error }: Props) {
  const id = useId();
  // Fixed at mount, so a device does not jump between the lists while the user checks it.
  const [primaryIds] = useState(() => new Set(devices.filter((d) => d.required || selected.includes(d.id)).map((d) => d.id)));
  const primary = devices.filter((device) => primaryIds.has(device.id));
  const more = devices.filter((device) => !primaryIds.has(device.id));

  function toggle(deviceId: string) {
    const next = selected.includes(deviceId) ? selected.filter((d) => d !== deviceId) : [...selected, deviceId];
    // Keep the catalogue order.
    onSelectedChange(devices.map((d) => d.id).filter((d) => next.includes(d)));
  }

  function deviceRow(device: CatalogueDevice) {
    return (
      <li key={device.id}>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1 text-sm">
          <input
            type="checkbox"
            className="checkbox"
            checked={selected.includes(device.id)}
            onChange={() => toggle(device.id)}
          />
          <span className="flex flex-wrap items-center gap-2">
            <span>{device.name}</span>
            {device.required ? <RequiredBadge /> : null}
          </span>
        </label>
        {device.condition ? <p className="ml-9 text-sm text-base-content/70">{device.condition}</p> : null}
      </li>
    );
  }

  return (
    <section className="card card-border bg-base-100" aria-labelledby={`${id}-title`}>
      <div className="card-body gap-3 p-4 sm:p-6">
        <h3 id={`${id}-title`} className="card-title text-base">
          {title}
        </h3>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            role="switch"
            className="toggle toggle-success"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <span>{en.target.enabled(title)}</span>
        </label>
        {devices.length === 0 ? (
          <p className="text-sm text-base-content/70">{en.target.noDevices}</p>
        ) : (
          <fieldset className="fieldset" disabled={!enabled} aria-describedby={error ? `${id}-error` : undefined}>
            <legend className="fieldset-legend">
              {en.target.devices}
              <span className="font-normal text-base-content/70"> · {en.target.selectedCount(selected.length, devices.length)}</span>
            </legend>
            <ul>{primary.map(deviceRow)}</ul>
            {more.length > 0 ? (
              <details className="collapse collapse-arrow border border-base-300">
                <summary className="collapse-title min-h-11 font-medium">{en.target.moreDevices(more.length)}</summary>
                <div className="collapse-content">
                  <ul>{more.map(deviceRow)}</ul>
                </div>
              </details>
            ) : null}
            {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
          </fieldset>
        )}
      </div>
    </section>
  );
}
