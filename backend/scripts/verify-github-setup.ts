import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GithubTool } from '../src/tools/standard/github.tool';
import { ToolContext } from '../src/tools/tool-runtime.service';
import * as dotenv from 'dotenv';

dotenv.config();

async function verifyGithubSetup() {
  console.log('🕵️‍♀️ Verifying GitHub Setup and Workflow existence...');

  // Manually instantiate tool to test connection
  const githubTool = new GithubTool();
  
  // Mock context
  const ctx: ToolContext = {
    runId: 'verify-script',
    stepId: 'init',
    tenantId: 'system',
  };

  try {
    // 1. Test Auth by listing repos
    console.log('\n1. Testing Authentication...');
    const repos = await githubTool.handler({ operation: 'list_repos' }, ctx);
    if (repos.repositories) {
        console.log(`✅ Auth Successful! Found ${repos.total_count} repositories accessible to this App.`);
        const myRepo = repos.repositories.find((r: any) => r.name === 'LogLine-LLM-World-New');
        if (myRepo) {
            console.log(`✅ Found target repo: ${myRepo.full_name}`);
        } else {
            console.warn(`⚠️ Target repo 'LogLine-LLM-World-New' not found in app installation. Is the App installed on this repo?`);
        }
    }

    // 2. Check for Workflow File
    console.log('\n2. Checking for .github/workflows/deploy-executor.yml...');
    try {
        const file = await githubTool.handler({
            operation: 'get_file_content',
            owner: 'danvoulez',
            repo: 'LogLine-LLM-World-New',
            path: '.github/workflows/deploy-executor.yml'
        }, ctx);
        
        console.log('✅ Workflow file found on remote!');
        console.log('--- File Content Preview ---');
        console.log(file.content.substring(0, 100) + '...');
    } catch (e: any) {
        console.error('❌ Workflow file NOT found on remote:', e.message);
        console.log('This suggests the push might not have succeeded or the file path is wrong.');
    }

  } catch (error: any) {
    console.error('❌ Verification Failed:', error.message);
  }
}

verifyGithubSetup();

