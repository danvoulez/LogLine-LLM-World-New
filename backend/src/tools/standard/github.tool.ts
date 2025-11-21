import { Injectable, Logger } from '@nestjs/common';
import { ToolHandler, ToolContext } from '../tool-runtime.service';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';

@Injectable()
export class GithubTool {
  private readonly logger = new Logger(GithubTool.name);

  getDefinition() {
    return {
      id: 'github_api',
      name: 'GitHub API',
      description: 'Interact with GitHub API to manage repositories, issues, and PRs.',
      risk_level: 'medium',
      side_effects: ['external_api_call'],
      input_schema: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['get_issue', 'create_issue', 'get_pr', 'list_repos', 'get_file_content'] },
          owner: { type: 'string', description: 'Repository owner (org or user)' },
          repo: { type: 'string', description: 'Repository name' },
          issue_number: { type: 'number', description: 'Issue or PR number' },
          title: { type: 'string', description: 'Title for new issue' },
          body: { type: 'string', description: 'Body for new issue' },
          path: { type: 'string', description: 'File path for get_file_content' },
        },
        required: ['operation'],
      },
      handler_type: 'builtin',
      handler_config: { handler: 'github_api' },
    };
  }

  handler: ToolHandler = async (input: any, ctx: ToolContext) => {
    const { operation, owner, repo, issue_number, title, body, path } = input;

    this.logger.log(`Executing GitHub Tool operation: ${operation}`);

    const octokit = this.getOctokitClient();

    try {
      switch (operation) {
        case 'get_issue':
          if (!owner || !repo || !issue_number) {
            throw new Error('Missing owner, repo, or issue_number for get_issue');
          }
          const issue = await octokit.rest.issues.get({
            owner,
            repo,
            issue_number,
          });
          return {
            id: issue.data.id,
            number: issue.data.number,
            title: issue.data.title,
            body: issue.data.body,
            state: issue.data.state,
            html_url: issue.data.html_url,
          };

        case 'create_issue':
          if (!owner || !repo || !title) {
            throw new Error('Missing owner, repo, or title for create_issue');
          }
          const newIssue = await octokit.rest.issues.create({
            owner,
            repo,
            title,
            body,
          });
          return {
            id: newIssue.data.id,
            number: newIssue.data.number,
            html_url: newIssue.data.html_url,
          };

        case 'get_pr':
          if (!owner || !repo || !issue_number) {
            throw new Error('Missing owner, repo, or issue_number for get_pr');
          }
          const pr = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: issue_number,
          });
          return {
            id: pr.data.id,
            number: pr.data.number,
            title: pr.data.title,
            body: pr.data.body,
            state: pr.data.state,
            merged: pr.data.merged,
            html_url: pr.data.html_url,
          };

        case 'list_repos':
          // Lists repos for the installation
          const repos = await octokit.rest.apps.listReposAccessibleToInstallation();
          return {
            total_count: repos.data.total_count,
            repositories: repos.data.repositories.map((r) => ({
              name: r.name,
              full_name: r.full_name,
              private: r.private,
              html_url: r.html_url,
            })),
          };
        
        case 'get_file_content':
           if (!owner || !repo || !path) {
             throw new Error('Missing owner, repo, or path for get_file_content');
           }
           const content = await octokit.rest.repos.getContent({
             owner,
             repo,
             path,
           });
           
           if (Array.isArray(content.data) || !('content' in content.data)) {
             throw new Error('Path is a directory or not a file');
           }
           
           return {
             name: content.data.name,
             path: content.data.path,
             content: Buffer.from(content.data.content, 'base64').toString('utf-8'),
           };

        default:
          throw new Error(`Operation ${operation} not implemented`);
      }
    } catch (error: any) {
      this.logger.error(`GitHub Tool Error: ${error.message}`, error.stack);
      throw new Error(`GitHub Tool failed: ${error.message}`);
    }
  };

  private getOctokitClient(): Octokit {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_PRIVATE_KEY;
    const installationId = process.env.GITHUB_INSTALLATION_ID;

    if (appId && privateKey && installationId) {
      // Authenticate as GitHub App
      return new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          installationId,
        },
      });
    } else if (process.env.GITHUB_TOKEN) {
      // Authenticate with PAT
      return new Octokit({ auth: process.env.GITHUB_TOKEN });
    } else {
      // Unauthenticated (rate limited, read-only public)
      this.logger.warn('No GitHub credentials found. Using unauthenticated client.');
      return new Octokit();
    }
  }
}
