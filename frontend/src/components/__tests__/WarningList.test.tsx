import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WarningList } from '../WarningList';
import type { Warning } from '../../lib/api';

describe('WarningList', () => {
  it('should render empty state when no warnings', () => {
    render(<WarningList warnings={[]} />);
    expect(screen.getByText('No warnings')).toBeInTheDocument();
  });

  it('should render warning count in header', () => {
    const warnings: Warning[] = [
      { severity: 'warn', code: 'DIRTY', message: 'Test warning' },
      { severity: 'error', code: 'CI_FAIL', message: 'Test error' },
    ];
    render(<WarningList warnings={warnings} />);
    expect(screen.getByText('Warnings (2)')).toBeInTheDocument();
  });

  it('should render warning messages', () => {
    const warnings: Warning[] = [
      { severity: 'warn', code: 'DIRTY', message: 'Uncommitted changes' },
    ];
    render(<WarningList warnings={warnings} />);
    expect(screen.getByText('Uncommitted changes')).toBeInTheDocument();
    expect(screen.getByText('DIRTY')).toBeInTheDocument();
  });

  it('should render error messages', () => {
    const warnings: Warning[] = [
      { severity: 'error', code: 'CI_FAIL', message: 'CI failed' },
    ];
    render(<WarningList warnings={warnings} />);
    expect(screen.getByText('CI failed')).toBeInTheDocument();
    expect(screen.getByText('CI_FAIL')).toBeInTheDocument();
  });

  it('should display correct icons for severity', () => {
    const warnings: Warning[] = [
      { severity: 'warn', code: 'DIRTY', message: 'Warning' },
      { severity: 'error', code: 'CI_FAIL', message: 'Error' },
    ];
    render(<WarningList warnings={warnings} />);
    // Check for emoji icons
    expect(screen.getByText('⚠️')).toBeInTheDocument();
    expect(screen.getByText('⛔')).toBeInTheDocument();
  });
});
