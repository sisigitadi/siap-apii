import React from 'react';
import { LETTER_TYPE_LABELS, STATUS_BADGES } from '@/utils/constants';
import { CashCategory, Division, LetterStatus, LetterType, SubmissionStatus, VoucherStatus } from '@/api/types';
import { DIVISION_LABELS, CASH_CATEGORIES } from '@/utils/constants';

type BadgeKind = LetterStatus | SubmissionStatus | VoucherStatus;

interface StatusBadgeProps {
  status: BadgeKind;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const badge = STATUS_BADGES[status];
  if (!badge) return <span className="text-xs">{status}</span>;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color} ${badge.bg} ${badge.border} ${className}`}
    >
      {badge.label}
    </span>
  );
};

export const LetterTypeBadge: React.FC<{ type: LetterType; className?: string }> = ({ type, className = '' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 ${className}`}>
    {LETTER_TYPE_LABELS[type] || type}
  </span>
);

export const DivisionBadge: React.FC<{ division: Division; className?: string }> = ({ division, className = '' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}>
    {DIVISION_LABELS[division] || division}
  </span>
);

export const CategoryBadge: React.FC<{ category: CashCategory; className?: string }> = ({ category, className = '' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 ${className}`}>
    {CASH_CATEGORIES[category] || category}
  </span>
);
