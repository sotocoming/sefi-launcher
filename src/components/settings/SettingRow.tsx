import { useId, type ReactNode } from 'react';

type RowProps = {
  title: string;
  description?: string;
  note?: string;
  control?: ReactNode | ((descriptionId?: string) => ReactNode);
  children?: ReactNode;
  className?: string;
  headingLevel?: 'h2' | 'h3';
};

/** One reading order and one label/control baseline throughout Settings. */
export function SettingRow({ title, description, note, control, children, className = '', headingLevel: Heading = 'h2' }: RowProps) {
  const id = useId();
  const describedBy = [description && id + '-description', note && id + '-note'].filter(Boolean).join(' ') || undefined;
  return <div className={'setting-row ' + className}>
    <div className="setting-row-main">
      <div className="setting-row-copy">
        <Heading className="setting-row-title">{title}</Heading>
        {description && <p id={id + '-description'} className="setting-row-description">{description}</p>}
        {note && <p id={id + '-note'} className="setting-row-note">{note}</p>}
      </div>
      {control && <div className="setting-row-control">{typeof control === 'function' ? control(describedBy) : control}</div>}
    </div>
    {children && <div className="setting-row-body">{children}</div>}
  </div>;
}

type SwitchProps = Omit<RowProps, 'control' | 'children'> & {
  accessibleName: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export function SwitchSetting({ accessibleName, checked, disabled, onToggle, ...row }: SwitchProps) {
  return <SettingRow {...row} control={descriptionId =>
    <button type="button" className="setting-switch-button" role="switch" aria-label={accessibleName}
      aria-describedby={descriptionId} aria-checked={checked} disabled={disabled} onClick={onToggle}>
      <span className="setting-switch-track" aria-hidden="true"><i /></span>
    </button>
  } />;
}
