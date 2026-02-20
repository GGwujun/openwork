// automation/git/client.ts
// Git客户端 - 封装Git操作

import { Command } from '@tauri-apps/plugin-shell';

/**
 * Git配置
 */
export interface GitConfig {
  repoPath: string;
  userName: string;
  userEmail: string;
  defaultBranch?: string;
}

/**
 * 提交信息
 */
export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  files: string[];
}

/**
 * 分支信息
 */
export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  ahead: number;
  behind: number;
}

/**
 * Git状态
 */
export interface GitStatus {
  branch: string;
  modified: string[];
  added: string[];
  deleted: string[];
  renamed: string[];
  untracked: string[];
  isClean: boolean;
}

/**
 * Git客户端
 * 封装Git命令行操作
 */
export class GitClient {
  private config: GitConfig;

  constructor(config: GitConfig) {
    this.config = {
      defaultBranch: 'main',
      ...config,
    };
  }

  /**
   * 执行Git命令
   */
  private async execGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      const command = new Command('git', args, { cwd: this.config.repoPath });
      const output = await command.execute();
      return output;
    } catch (error) {
      throw new Error(`Git命令失败: ${args.join(' ')} - ${error}`);
    }
  }

  /**
   * 初始化仓库
   */
  async init(): Promise<void> {
    await this.execGit(['init']);
    await this.execGit(['config', 'user.name', this.config.userName]);
    await this.execGit(['config', 'user.email', this.config.userEmail]);
  }

  /**
   * 克隆仓库
   */
  static async clone(
    repoUrl: string, 
    targetPath: string, 
    branch?: string
  ): Promise<GitClient> {
    const args = ['clone'];
    if (branch) {
      args.push('--branch', branch);
    }
    args.push(repoUrl, targetPath);

    const command = new Command('git', args);
    await command.execute();

    // 返回新的GitClient实例
    return new GitClient({
      repoPath: targetPath,
      userName: '',
      userEmail: '',
    });
  }

  /**
   * 获取状态
   */
  async status(): Promise<GitStatus> {
    const { stdout } = await this.execGit([
      'status', '--porcelain', '--branch', '--untracked-files=all'
    ]);

    const lines = stdout.split('\n').filter(Boolean);
    const status: GitStatus = {
      branch: 'main',
      modified: [],
      added: [],
      deleted: [],
      renamed: [],
      untracked: [],
      isClean: true,
    };

    for (const line of lines) {
      // 解析分支信息
      if (line.startsWith('##')) {
        const branchMatch = line.match(/##\s+([^\.\s]+)/);
        if (branchMatch) {
          status.branch = branchMatch[1];
        }
        continue;
      }

      // 解析文件状态
      const state = line.slice(0, 2);
      const file = line.slice(3);

      if (state.includes('M')) status.modified.push(file);
      if (state.includes('A')) status.added.push(file);
      if (state.includes('D')) status.deleted.push(file);
      if (state.includes('R')) {
        const [oldFile, newFile] = file.split(' -> ');
        status.renamed.push(`${oldFile} -> ${newFile || oldFile}`);
      }
      if (state === '??') status.untracked.push(file);
    }

    status.isClean = 
      status.modified.length === 0 && 
      status.added.length === 0 && 
      status.deleted.length === 0 && 
      status.untracked.length === 0;

    return status;
  }

  /**
   * 添加文件到暂存区
   */
  async add(files: string | string[]): Promise<void> {
    const fileList = Array.isArray(files) ? files : [files];
    if (fileList.length === 0) return;
    await this.execGit(['add', ...fileList]);
  }

  /**
   * 添加所有更改
   */
  async addAll(): Promise<void> {
    await this.execGit(['add', '.']);
  }

  /**
   * 创建提交
   */
  async commit(
    message: string, 
    options?: { 
      body?: string;
      relatedWorkItem?: number;
      skipHooks?: boolean;
    }
  ): Promise<string> {
    let fullMessage = message;
    
    if (options?.body) {
      fullMessage += `\n\n${options.body}`;
    }
    
    if (options?.relatedWorkItem) {
      fullMessage += `\n\nRelated-TFS-Work-Item: #${options.relatedWorkItem}`;
    }

    const args = ['commit', '-m', fullMessage];
    if (options?.skipHooks) {
      args.push('--no-verify');
    }

    await this.execGit(args);
    
    // 获取提交hash
    const { stdout } = await this.execGit(['rev-parse', 'HEAD']);
    return stdout.trim();
  }

  /**
   * 创建分支
   */
  async createBranch(
    branchName: string, 
    baseBranch?: string
  ): Promise<void> {
    const args = ['checkout', '-b', branchName];
    if (baseBranch) {
      args.push(baseBranch);
    }
    await this.execGit(args);
  }

  /**
   * 切换分支
   */
  async checkout(branchName: string, create = false): Promise<void> {
    const args = ['checkout'];
    if (create) {
      args.push('-b');
    }
    args.push(branchName);
    await this.execGit(args);
  }

  /**
   * 获取分支列表
   */
  async getBranches(): Promise<BranchInfo[]> {
    const { stdout } = await this.execGit([
      'branch', '-vv', '--format=%(refname:short)|%(upstream:short)|%(upstream:track)'
    ]);

    const lines = stdout.split('\n').filter(Boolean);
    const branches: BranchInfo[] = [];

    for (const line of lines) {
      const [name, upstream, track] = line.split('|');
      const isCurrent = line.startsWith('*');
      const cleanName = name.replace(/^\*?\s*/, '');

      let ahead = 0, behind = 0;
      if (track) {
        const aheadMatch = track.match(/ahead\s+(\d+)/);
        const behindMatch = track.match(/behind\s+(\d+)/);
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
        if (behindMatch) behind = parseInt(behindMatch[1], 10);
      }

      branches.push({
        name: cleanName,
        isCurrent,
        isRemote: !!upstream,
        ahead,
        behind,
      });
    }

    return branches;
  }

  /**
   * 获取当前分支
   */
  async getCurrentBranch(): Promise<string> {
    const { stdout } = await this.execGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    return stdout.trim();
  }

  /**
   * 推送分支
   */
  async push(
    remote: string = 'origin', 
    branch?: string,
    force = false
  ): Promise<void> {
    const args = ['push'];
    if (force) args.push('--force');
    args.push(remote);
    if (branch) args.push(branch);
    
    await this.execGit(args);
  }

  /**
   * 拉取更新
   */
  async pull(remote: string = 'origin', branch?: string): Promise<void> {
    const args = ['pull', remote];
    if (branch) args.push(branch);
    await this.execGit(args);
  }

  /**
   * 获取提交历史
   */
  async getLog(count: number = 10): Promise<CommitInfo[]> {
    const format = '%H|%an|%ae|%ad|%s';
    const { stdout } = await this.execGit([
      'log', `-${count}`, `--format=${format}`, '--date=iso'
    ]);

    const lines = stdout.split('\n').filter(Boolean);
    return lines.map(line => {
      const [hash, author, email, date, ...messageParts] = line.split('|');
      return {
        hash,
        author,
        email,
        date: new Date(date),
        message: messageParts.join('|'),
        files: [],
      };
    });
  }

  /**
   * 获取文件差异
   */
  async getDiff(files?: string[]): Promise<string> {
    const args = ['diff'];
    if (files) {
      args.push('--', ...files);
    }
    const { stdout } = await this.execGit(args);
    return stdout;
  }

  /**
   * 重置更改
   */
  async reset(files?: string[], hard = false): Promise<void> {
    const args = ['reset'];
    if (hard) {
      args.push('--hard');
    } else {
      args.push('HEAD');
    }
    if (files) {
      args.push('--', ...files);
    }
    await this.execGit(args);
  }

  /**
   * 清理未跟踪文件
   */
  async clean(force = false): Promise<void> {
    const args = ['clean', '-fd'];
    if (force) args.push('-f');
    await this.execGit(args);
  }

  /**
   * 获取远程列表
   */
  async getRemotes(): Promise<Array<{ name: string; url: string }>> {
    const { stdout } = await this.execGit(['remote', '-v']);
    const lines = stdout.split('\n').filter(Boolean);
    const remotes: Array<{ name: string; url: string }> = [];
    const seen = new Set<string>();

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2 && !seen.has(parts[0])) {
        remotes.push({ name: parts[0], url: parts[1] });
        seen.add(parts[0]);
      }
    }

    return remotes;
  }

  /**
   * 添加远程仓库
   */
  async addRemote(name: string, url: string): Promise<void> {
    await this.execGit(['remote', 'add', name, url]);
  }

  /**
   * 获取仓库路径
   */
  getRepoPath(): string {
    return this.config.repoPath;
  }

  /**
   * 检查是否是Git仓库
   */
  static async isGitRepo(path: string): Promise<boolean> {
    try {
      const command = new Command('git', ['rev-parse', '--git-dir'], { cwd: path });
      await command.execute();
      return true;
    } catch {
      return false;
    }
  }
}

export default GitClient;
