import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary'
          ? 'bg-[var(--accent)] text-[#061013] hover:bg-[#62e3d8]'
          : 'border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] hover:border-[var(--accent)]',
        className,
      )}
      {...props}
    />
  );
}
