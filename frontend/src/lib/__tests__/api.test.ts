import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('health', () => {
    it('should return health status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      });

      const result = await api.health();
      expect(result).toEqual({ status: 'ok' });
      expect(mockFetch).toHaveBeenCalledWith('/api/health', {
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('getRepos', () => {
    it('should return list of repos', async () => {
      const repos = [{ id: 1, path: '/test', name: 'test' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(repos),
      });

      const result = await api.getRepos();
      expect(result).toEqual(repos);
    });
  });

  describe('createRepo', () => {
    it('should create a new repo', async () => {
      const repo = { id: 1, path: '/test', name: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(repo),
      });

      const result = await api.createRepo('/test', 'test');
      expect(result).toEqual(repo);
      expect(mockFetch).toHaveBeenCalledWith('/api/repos', {
        method: 'POST',
        body: JSON.stringify({ path: '/test', name: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('getBranchNaming', () => {
    it('should get branch naming rule', async () => {
      const rule = {
        id: 1,
        repoId: 1,
        pattern: 'vt/{planId}/{taskSlug}',
        description: 'test',
        examples: [],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(rule),
      });

      const result = await api.getBranchNaming(1);
      expect(result).toEqual(rule);
    });
  });

  describe('updateBranchNaming', () => {
    it('should update branch naming rule', async () => {
      const input = {
        repoId: 1,
        pattern: 'vt/{planId}/{taskSlug}',
        description: 'test',
        examples: ['vt/1/feature'],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, ...input }),
      });

      const result = await api.updateBranchNaming(input);
      expect(result.pattern).toBe(input.pattern);
    });
  });

  describe('getCurrentPlan', () => {
    it('should return current plan', async () => {
      const plan = { id: 1, repoId: 1, title: 'Test', status: 'draft' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(plan),
      });

      const result = await api.getCurrentPlan(1);
      expect(result).toEqual(plan);
    });

    it('should return null when no plan', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null),
      });

      const result = await api.getCurrentPlan(1);
      expect(result).toBeNull();
    });
  });

  describe('startPlan', () => {
    it('should create a new plan', async () => {
      const plan = { id: 1, repoId: 1, title: 'Test', status: 'draft' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(plan),
      });

      const result = await api.startPlan(1, 'Test');
      expect(result).toEqual(plan);
    });
  });

  describe('updatePlan', () => {
    it('should update plan content', async () => {
      const plan = { id: 1, contentMd: '# Updated' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(plan),
      });

      const result = await api.updatePlan(1, '# Updated');
      expect(result.contentMd).toBe('# Updated');
    });
  });

  describe('commitPlan', () => {
    it('should commit plan', async () => {
      const plan = { id: 1, status: 'committed' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(plan),
      });

      const result = await api.commitPlan(1);
      expect(result.status).toBe('committed');
    });
  });

  describe('scan', () => {
    it('should scan repository', async () => {
      const snapshot = {
        nodes: [],
        edges: [],
        warnings: [],
        worktrees: [],
        rules: { branchNaming: null },
        restart: null,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(snapshot),
      });

      const result = await api.scan(1);
      expect(result).toEqual(snapshot);
    });
  });

  describe('logInstruction', () => {
    it('should log instruction', async () => {
      const log = {
        id: 1,
        repoId: 1,
        kind: 'user_instruction',
        contentMd: 'Test',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(log),
      });

      const result = await api.logInstruction({
        repoId: 1,
        kind: 'user_instruction',
        contentMd: 'Test',
      });
      expect(result).toEqual(log);
    });
  });

  describe('error handling', () => {
    it('should throw error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      await expect(api.getRepo(999)).rejects.toThrow('Not found');
    });

    it('should handle JSON parse errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(api.health()).rejects.toThrow('HTTP error: 500');
    });
  });
});
