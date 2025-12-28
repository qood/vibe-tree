import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { BranchNamingDisplay } from '../BranchNamingDisplay';
import type { BranchNamingRule } from '../../lib/api';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('BranchNamingDisplay', () => {
  it('should render empty state when no rule', () => {
    render(<BranchNamingDisplay rule={null} repoId={1} />, { wrapper });
    expect(screen.getByText('No branch naming rule configured')).toBeInTheDocument();
    expect(screen.getByText('Configure in Settings')).toBeInTheDocument();
  });

  it('should render rule details', () => {
    const rule: BranchNamingRule = {
      id: 1,
      repoId: 1,
      pattern: 'vt/{planId}/{taskSlug}',
      description: 'Default pattern',
      examples: ['vt/1/add-auth', 'vt/2/fix-bug'],
    };
    render(<BranchNamingDisplay rule={rule} repoId={1} />, { wrapper });

    expect(screen.getByText('Branch Naming Rule')).toBeInTheDocument();
    expect(screen.getByText('Pattern:')).toBeInTheDocument();
    expect(screen.getByText('vt/{planId}/{taskSlug}')).toBeInTheDocument();
    expect(screen.getByText('vt/1/add-auth')).toBeInTheDocument();
    expect(screen.getByText('vt/2/fix-bug')).toBeInTheDocument();
  });

  it('should show edit link when showEditLink is true', () => {
    const rule: BranchNamingRule = {
      id: 1,
      repoId: 1,
      pattern: 'test',
      description: '',
      examples: [],
    };
    render(<BranchNamingDisplay rule={rule} repoId={1} showEditLink={true} />, {
      wrapper,
    });

    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('should hide edit link when showEditLink is false', () => {
    const rule: BranchNamingRule = {
      id: 1,
      repoId: 1,
      pattern: 'test',
      description: '',
      examples: [],
    };
    render(<BranchNamingDisplay rule={rule} repoId={1} showEditLink={false} />, {
      wrapper,
    });

    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('should render description when present', () => {
    const rule: BranchNamingRule = {
      id: 1,
      repoId: 1,
      pattern: 'test',
      description: 'This is a description',
      examples: [],
    };
    render(<BranchNamingDisplay rule={rule} repoId={1} />, { wrapper });

    expect(screen.getByText('Description:')).toBeInTheDocument();
    expect(screen.getByText('This is a description')).toBeInTheDocument();
  });
});
