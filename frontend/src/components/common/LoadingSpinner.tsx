import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', label, className = '' }) => {
  const sizeClasses: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-[3px]',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-8 ${className}`}>
      <div
        className={`${sizeClasses[size]} border-[#0e3b6f] border-t-transparent rounded-full animate-spin`}
        role="status"
        aria-label="Memuat"
      />
      {label && <p className="text-xs text-slate-500 font-medium">{label}</p>}
    </div>
  );
};
