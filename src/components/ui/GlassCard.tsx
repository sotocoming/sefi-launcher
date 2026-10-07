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
      className={`rounded-[14px] border border-white/[0.08] bg-[#12101c]/75 backdrop-blur-[18px] shadow-[0_24px_60px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 ${
        glow ? 'border-sefi-purple/30 shadow-[0_0_30px_rgba(180,92,255,0.15)]' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
