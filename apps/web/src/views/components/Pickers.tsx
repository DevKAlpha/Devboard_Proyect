/**
 * Selection grids reused by onboarding and the "new board" modal.
 * Built as radio groups so keyboard and screen-reader users get the
 * native arrow-key behaviour for free.
 */
import type { ReactNode } from 'react';
import { PROFILE_INFO, ProfileSchema, type Profile } from '@devbord/shared';
import { cx } from '../../design';
import type { BoardTemplate } from '../../templates';

interface OptionCardProps {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  preview?: ReactNode;
}

function OptionCard({
  name,
  value,
  checked,
  onSelect,
  title,
  description,
  preview,
}: OptionCardProps) {
  return (
    <label
      className={cx(
        'flex cursor-pointer flex-col gap-1.5 rounded-xl border bg-card p-4 shadow-card transition-[transform,box-shadow,border-color]',
        // The radio is visually hidden, so show its keyboard focus on the card.
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-accent',
        checked
          ? 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]'
          : 'border-line-soft hover:-translate-y-0.5 hover:shadow-lift',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      {preview}
      <span className="font-pixel text-base">{title}</span>
      <span className="text-sm text-muted">{description}</span>
    </label>
  );
}

export function ProfilePicker({
  value,
  onChange,
}: {
  value: Profile;
  onChange: (p: Profile) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Perfil" className="grid gap-3 sm:grid-cols-2">
      {ProfileSchema.options.map((p) => (
        <OptionCard
          key={p}
          name="profile"
          value={p}
          checked={value === p}
          onSelect={() => onChange(p)}
          title={PROFILE_INFO[p].title}
          description={PROFILE_INFO[p].description}
        />
      ))}
    </div>
  );
}

/** Column-count preview bars, so templates are recognisable at a glance. */
const ColumnsPreview = ({ count }: { count: number }) => (
  <span className="mb-1 flex h-6 gap-1" aria-hidden>
    {Array.from({ length: count }, (_, i) => (
      <span
        key={i}
        className="flex-1 rounded-[2px] bg-surface-3"
        style={{ height: `${100 - i * 12}%` }}
      />
    ))}
  </span>
);

export function TemplatePicker({
  templates,
  value,
  onChange,
}: {
  templates: readonly BoardTemplate[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Plantilla" className="grid gap-3 sm:grid-cols-2">
      {templates.map((t) => (
        <OptionCard
          key={t.id}
          name="template"
          value={t.id}
          checked={value === t.id}
          onSelect={() => onChange(t.id)}
          title={t.name}
          description={t.description}
          preview={<ColumnsPreview count={t.columns.length} />}
        />
      ))}
    </div>
  );
}
