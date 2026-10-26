import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  glow = false,
  ...props
}) => {
  return (
    <div
      className={`sefi-panel ${glow ? 'sefi-panel-accent' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
