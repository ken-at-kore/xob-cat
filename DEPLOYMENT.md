# DEPLOYMENT GUIDE

Complete deployment setup and reference for XOB CAT production infrastructure.

## 🌐 Live Production URLs

### Frontend
- **Primary (Custom Domain)**: https://www.koreai-xobcat.com
- **Amplify URL**: https://main.d72hemfmh671a.amplifyapp.com

### Backend API
- **REST API**: https://ed8fqpj0n2.execute-api.us-east-2.amazonaws.com/Prod

## 🔧 AWS Configuration

### Profile & Region
- **AWS Profile**: `ken-at-kore` (required for all AWS CLI commands)
- **AWS Region**: `us-east-2` (Ohio)
- **Account**: `839214966235`

### Usage Pattern
```bash
# Always use this pattern for AWS CLI commands:
aws [service] [command] --profile ken-at-kore --region us-east-2
```

## 🎯 Frontend Deployment (Amplify)

### App Configuration
- **App ID**: `d72hemfmh671a`
- **Service**: AWS Amplify Hosting
- **Platform**: `WEB_COMPUTE` (Next.js SSR)
- **Framework**: Next.js - SSR
- **Branch**: `main` (auto-deploy on push)

### Directory Structure
- **Repository Root**: `/` (monorepo)
- **App Root**: `frontend/` (specified in Amplify settings)
- **Build Config**: `amplify.yml` (in project root)

### Build Configuration (`amplify.yml`)
```yaml
version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - node --version
            - npm --version
            - npm ci --legacy-peer-deps
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
```

### Environment Variables (Amplify Console)
- **NEXT_PUBLIC_API_URL**: `https://ed8fqpj0n2.execute-api.us-east-2.amazonaws.com/Prod`
- **AMPLIFY_DIFF_DEPLOY**: `false`
- **AMPLIFY_MONOREPO_APP_ROOT**: `frontend`

### Deployment Commands
```bash
# Manual deployment trigger
aws amplify start-job \
  --app-id d72hemfmh671a \
  --branch-name main \
  --job-type RELEASE \
  --job-reason "Manual deployment" \
  --region us-east-2 \
  --profile ken-at-kore

# Monitor deployment
aws amplify list-jobs \
  --app-id d72hemfmh671a \
  --branch-name main \
  --max-results 5 \
  --profile ken-at-kore \
  --region us-east-2
```

### Automatic Deployments
- **Trigger**: Push to `main` branch
- **Source**: GitHub repo `ken-at-kore/xob-cat`
- **Build Time**: ~3-5 minutes
- **Deploy Method**: Amplify Console continuous deployment

## ⚡ Backend Deployment (AWS Lambda + API Gateway)

### Infrastructure Overview
- **Service**: AWS Lambda (Node.js 18.x, ARM64)
- **API**: REST API Gateway (switched from HTTP API for aws-serverless-express compatibility)
- **Stack Name**: `xobcat-backend`
- **Framework**: Express.js via `aws-serverless-express`
- **Function Name**: `xobcat-backend-ApiFunction-7yG0yqId5Qg2`

### CloudFormation Stack
- **Template**: `xobcat-backend/template.yaml`
- **Deployment Tool**: AWS CLI (CloudFormation)
- **Handler**: `simple-lambda.handler`
- **S3 Bucket**: `xobcat-lambda-fix-1753902369` (for Lambda code deployment)

### Build Process (`backend/`)
```bash
# Build for Lambda deployment (from project root)
./package-lambda.sh

# This script:
# 1. Copies shared files to backend/src/shared/
# 2. Compiles TypeScript with tsconfig.build.json
# 3. Creates focused Lambda package with production dependencies
# 4. Handles monorepo dependency hoisting issues
# 5. Creates lambda-focused.zip for deployment
```

### Deployment Script
```bash
# Full backend deployment (from project root)
./package-lambda.sh

# Manual deployment steps:
# 1. Build and package Lambda
./package-lambda.sh

# 2. Upload to S3
cd backend/lambda-package
zip -r ../lambda-focused.zip .
aws s3 cp ../lambda-focused.zip s3://xobcat-lambda-fix-1753902369/ --profile ken-at-kore

# 3. Deploy CloudFormation stack
cd ../../xobcat-backend
aws cloudformation deploy --template-file template.yaml \
  --stack-name xobcat-backend \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides FrontendUrl="https://main.d72hemfmh671a.amplifyapp.com" \
  --region us-east-2 \
  --profile ken-at-kore

# 4. Update Lambda function code (if function exists)
aws lambda update-function-code \
  --function-name xobcat-backend-ApiFunction-7yG0yqId5Qg2 \
  --s3-bucket xobcat-lambda-fix-1753902369 \
  --s3-key lambda-focused.zip \
  --profile ken-at-kore
```

### Stack Management
```bash
# Check stack status
aws cloudformation describe-stacks \
  --stack-name xobcat-backend \
  --region us-east-2 \
  --profile ken-at-kore

# Get API URL
aws cloudformation describe-stacks \
  --stack-name xobcat-backend \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text \
  --region us-east-2 \
  --profile ken-at-kore

# Delete stack (if needed)
aws cloudformation delete-stack \
  --stack-name xobcat-backend \
  --region us-east-2 \
  --profile ken-at-kore
```

## 🚀 Complete Deployment Workflow

### Initial Setup (One-time)
1. **Backend**: Run `./deploy-backend.sh`
2. **Get API URL** from CloudFormation outputs
3. **Update Amplify** environment variable `NEXT_PUBLIC_API_URL`
4. **Redeploy frontend** (auto-triggers on env var change)

### Regular Updates

#### Frontend Updates
- **Method**: Push to `main` branch
- **Auto-deploy**: Yes (via Amplify)
- **Time**: ~3-5 minutes

#### Backend Updates
```bash
# 1. Make code changes in backend/
# 2. Build and deploy
./package-lambda.sh

# 3. Upload and update Lambda function
cd backend/lambda-package && zip -r ../lambda-focused.zip .
aws s3 cp ../lambda-focused.zip s3://xobcat-lambda-fix-1753902369/ --profile ken-at-kore
aws lambda update-function-code \
  --function-name xobcat-backend-ApiFunction-7yG0yqId5Qg2 \
  --s3-bucket xobcat-lambda-fix-1753902369 \
  --s3-key lambda-focused.zip --profile ken-at-kore

# 4. No frontend changes needed (API URL stays same)
```

## 🛠️ Development vs Production

### Local Development
```bash
# Start both frontend and backend locally
npm run start

# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

### Production Architecture
```
GitHub (main branch)
    ↓ (auto-deploy)
AWS Amplify (Next.js SSR)
    ↓ (API calls)
AWS Lambda + API Gateway (Express.js)
```

## 🔍 Monitoring & Debugging

### Frontend Logs
- **Location**: Amplify Console → App → Branch → Build logs
- **Real-time**: Build progress during deployment

### Backend Logs

#### Find Lambda Function Name
```bash
# List Lambda functions to find exact function name
aws lambda list-functions \
  --region us-east-2 \
  --profile ken-at-kore \
  --query 'Functions[?starts_with(FunctionName, `xobcat-backend`)].FunctionName' \
  --output table
```

#### Access Lambda Logs via CloudWatch
```bash
# 1. Find the log group (exact name needed)
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/xobcat-backend" \
  --region us-east-2 \
  --profile ken-at-kore \
  --query 'logGroups[*].logGroupName' \
  --output table

# 2. Get recent logs (last 10 minutes) - replace LOG_GROUP_NAME with actual name
aws logs filter-log-events \
  --log-group-name "/aws/lambda/xobcat-backend-ApiFunction-7yG0yqId5Qg2" \
  --start-time $(date -j -v-10M +%s)000 \
  --region us-east-2 \
  --profile ken-at-kore \
  --query 'events[*].[timestamp,message]' \
  --output table

# 3. Tail real-time logs (follow mode)
aws logs tail /aws/lambda/xobcat-backend-ApiFunction-7yG0yqId5Qg2 \
  --follow \
  --region us-east-2 \
  --profile ken-at-kore

# 4. Get logs for specific time range (useful for debugging specific issues)
aws logs filter-log-events \
  --log-group-name "/aws/lambda/xobcat-backend-ApiFunction-7yG0yqId5Qg2" \
  --start-time $(date -j -v-1H +%s)000 \
  --end-time $(date +%s)000 \
  --region us-east-2 \
  --profile ken-at-kore \
  --filter-pattern "ERROR" \
  --query 'events[*].[timestamp,message]' \
  --output table

# 5. Search for specific analysis ID in logs
aws logs filter-log-events \
  --log-group-name "/aws/lambda/xobcat-backend-ApiFunction-7yG0yqId5Qg2" \
  --start-time $(date -j -v-2H +%s)000 \
  --region us-east-2 \
  --profile ken-at-kore \
  --filter-pattern "a3d49a88-247c-4cf3-b2d5-edf0e7b51e15" \
  --query 'events[*].[timestamp,message]' \
  --output table
```

#### Common Log Analysis Patterns
```bash
# Find all auto-analysis related errors
aws logs filter-log-events \
  --log-group-name "/aws/lambda/xobcat-backend-ApiFunction-7yG0yqId5Qg2" \
  --start-time $(date -j -v-2H +%s)000 \
  --region us-east-2 \
  --profile ken-at-kore \
  --filter-pattern "auto-analyze ERROR" \
  --output table

# Monitor session sampling issues
aws logs filter-log-events \
  --log-group-name "/aws/lambda/xobcat-backend-ApiFunction-7yG0yqId5Qg2" \
  --start-time $(date -j -v-1H +%s)000 \
  --region us-east-2 \
  --profile ken-at-kore \
  --filter-pattern "sessionSamplingService" \
  --output table
```

### Health Checks
```bash
# Frontend health
curl https://main.d72hemfmh671a.amplifyapp.com

# Backend health
curl https://ed8fqpj0n2.execute-api.us-east-2.amazonaws.com/Prod/health

# Backend root endpoint
curl https://ed8fqpj0n2.execute-api.us-east-2.amazonaws.com/Prod
```

## 🔐 Security & Configuration

### Environment Variables
- **Frontend**: Set in Amplify Console
- **Backend**: Set in CloudFormation template
- **OpenAI API Keys**: User-provided at runtime (not stored in infrastructure)

### CORS Configuration
- **Allowed Origins**: 
  - `https://main.d72hemfmh671a.amplifyapp.com` (original Amplify URL)
  - `https://www.koreai-xobcat.com` (custom domain)
- **Configured in**: `backend/src/app.ts`
- **Note**: When adding custom domains, must update CORS origins array and redeploy backend

### IAM Roles
- **Amplify Service Role**: `AmplifySSRLoggingRole-d3c7wqin054t4y`
- **Lambda Execution Role**: Auto-created by CloudFormation

## 📋 Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Verify `amplify.yml` syntax
   - Check TypeScript compilation errors

2. **API Connection Issues**
   - Verify `NEXT_PUBLIC_API_URL` environment variable
   - Check CORS configuration
   - Test backend health endpoint

3. **Lambda Cold Starts**
   - Expected ~2-3 second delay on first request
   - Subsequent requests are fast

4. **"Load failed (0)" Frontend Errors**
   - **Root Cause**: Backend routing issues or wrong API Gateway type
   - **Symptoms**: Frontend shows "Unable to connect to the server (0)"
   - **Solutions**:
     - Ensure backend has root endpoint (`/`) defined
     - Use REST API Gateway instead of HTTP API for aws-serverless-express
     - Verify Lambda handler path is correct (`simple-lambda.handler`)
     - Check that Lambda function has proper dependencies packaged

5. **Lambda Routing Issues (All Routes Return Same Response)**
   - **Root Cause**: HTTP API vs REST API compatibility with aws-serverless-express
   - **Solution**: Switch CloudFormation template from `HttpApi` to `Api` (REST API)
   - **Update template.yaml**: Change event types and output URLs accordingly

6. **Monorepo Dependency Issues**
   - **Root Cause**: npm hoisting dependencies to root, Lambda can't find them
   - **Solution**: Use focused Lambda packaging with `./package-lambda.sh`
   - **Creates**: `lambda-package/` with only required production dependencies

7. **Custom Domain CORS Issues**
   - **Root Cause**: Backend CORS only allows original Amplify URL, blocks custom domains
   - **Symptoms**: "Load failed" errors when using custom domain, works fine on Amplify URL
   - **Solution**: Update CORS configuration in `backend/src/app.ts`:
     ```javascript
     app.use(cors({
       origin: [
         process.env.FRONTEND_URL || 'http://localhost:3000',
         'https://www.koreai-xobcat.com'  // Add custom domain
       ],
       // ... rest of CORS config
     }));
     ```
   - **Deployment**: Run `./package-lambda.sh` and update Lambda function

### Recovery Commands
```bash
# Redeploy frontend
aws amplify start-job --app-id d72hemfmh671a --branch-name main --job-type RELEASE --region us-east-2 --profile ken-at-kore

# Redeploy backend
./deploy-backend.sh

# Check both services
curl https://main.d72hemfmh671a.amplifyapp.com
curl https://ed8fqpj0n2.execute-api.us-east-2.amazonaws.com/Prod/health
```

## 🧪 Production Testing & Smoke Tests

### Mock Bot Credentials (Production Safe)
The application includes built-in mock credentials that connect to test data without affecting real systems:

```
Bot ID: st-mock-bot-id-12345
Client ID: cs-mock-client-id-12345  
Client Secret: mock-client-secret-12345
```

### Smoke Test Workflow
1. **Navigate to**: https://www.koreai-xobcat.com
2. **Use Mock Credentials**: Enter the mock credentials above to test bot connection
3. **Test Sessions View**: Verify mock session data loads in the sessions table

### Health Check Commands
```bash
# Frontend health
curl https://www.koreai-xobcat.com

# Backend health  
curl https://ed8fqpj0n2.execute-api.us-east-2.amazonaws.com/Prod/health

# Backend root endpoint
curl https://ed8fqpj0n2.execute-api.us-east-2.amazonaws.com/Prod
```

### OpenAI Testing
- **Test API Keys**: Use `sk-test-*` format for form validation testing
- **Real Analysis**: Requires valid OpenAI API key for actual session analysis
- **Mock Analysis**: Backend automatically uses mock data when no real Kore.ai connection

## 📝 Notes

- **Profile Requirement**: Always use `--profile ken-at-kore` for AWS CLI commands
- **Region Lock**: All resources in `us-east-2` (Ohio)
- **Monorepo Structure**: Frontend in `/frontend`, backend in `/backend`, shared code in `/shared`
- **Auto-deploy**: Frontend auto-deploys on git push, backend requires manual deployment
- **Cost**: Serverless architecture, pay-per-use pricing
- **Scaling**: Auto-scales based on demand

## 🔧 Recent Fixes & Updates

### July 30, 2025 - Backend Routing & API Gateway Fix
- **Issue**: Frontend showing "Load failed (0)" errors
- **Root Cause**: 
  - Missing root endpoint (`/`) in Express app
  - HTTP API Gateway incompatible with aws-serverless-express v3.4.0
  - Monorepo dependency hoisting causing Lambda package issues
- **Solutions Applied**:
  - Added root endpoint to `backend/src/app.ts`
  - Switched from HTTP API to REST API in CloudFormation template
  - Created focused Lambda packaging script (`./package-lambda.sh`)
  - Updated Amplify environment variable to new REST API URL
- **Result**: ✅ Full-stack application now working properly

### August 1, 2025 - Custom Domain CORS Configuration Fix
- **Issue**: Custom domain (https://www.koreai-xobcat.com) showing "Load failed" errors during bot connection
- **Root Cause**: Backend CORS configuration only allowed original Amplify URL, blocked custom domain requests
- **Symptoms**: 
  - ✅ Works perfectly on https://main.d72hemfmh671a.amplifyapp.com
  - ❌ "Load failed" on https://www.koreai-xobcat.com
  - Network requests from custom domain rejected by CORS policy
- **Solution Applied**:
  - Updated CORS origins in `backend/src/app.ts` from single string to array
  - Added `https://www.koreai-xobcat.com` to allowed origins
  - Rebuilt and redeployed Lambda function with `./package-lambda.sh`
- **Result**: ✅ Both original Amplify URL and custom domain now work perfectly

---

*Last updated: August 1, 2025*
*Deployment architecture: Amplify (SSR) + Lambda + REST API Gateway*