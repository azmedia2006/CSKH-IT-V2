import { api } from './api';

export interface CommitItem {
  sha: string;
  short_sha: string;
  title: string;
  full_message: string;
  type: 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'perf' | 'test' | 'chore' | 'build' | 'ci' | 'other';
  scope: string | null;
  author_name: string;
  author_email: string;
  author_avatar: string | null;
  date: string;
  html_url: string;
}

export interface CommitsResponse {
  repo: string;
  branch: string;
  total: number;
  synced_at: string;
  cached: boolean;
  commits: CommitItem[];
}

export interface RepoOption {
  id: string;
  name: string;
  default_branch: string;
  description: string;
  url: string;
}

export interface ReposResponse {
  default: string;
  repos: RepoOption[];
}

export const commitsApi = {
  getCommits: async (repo?: string, branch?: string, refresh: boolean = false): Promise<CommitsResponse> => {
    const params: Record<string, any> = { per_page: 60 };
    if (repo) params.repo = repo;
    if (branch) params.branch = branch;
    if (refresh) params.refresh = true;

    const response = await api.get('/commits', { params });
    return response.data;
  },

  getRepos: async (): Promise<ReposResponse> => {
    const response = await api.get('/commits/repos');
    return response.data;
  }
};
