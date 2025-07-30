# DEPLOYMENT GUIDE

Complete deployment setup and reference for XOB CAT production infrastructure.

## 🌐 Live Production URLs

- **Frontend**: https://main.d72hemfmh671a.amplifyapp.com
- **Backend API**: https://yp9om1wit1.execute-api.us-east-2.amazonaws.com

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
- **NEXT_PUBLIC_API_URL**: `https://yp9om1wit1.execute-api.us-east-2.amazonaws.com`

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
- **API**: HTTP API Gateway
- **Stack Name**: `xobcat-backend`
- **Framework**: Express.js via `aws-serverless-express`

### CloudFormation Stack
- **Template**: `xobcat-backend/template.yaml`
- **Deployment Tool**: AWS CLI (CloudFormation)
- **Handler**: `dist/lambda.handler`

### Build Process (`backend/`)
```bash
# Build for Lambda deployment
npm run build:lambda

# This runs: ./build-lambda.sh which:
# 1. Copies shared files to backend/src/shared/
# 2. Compiles TypeScript with tsconfig.build.json
# 3. Cleans up temporary files
```

### Deployment Script
```bash
# Full backend deployment
./deploy-backend.sh

# Manual deployment steps:
cd backend && npm run build:lambda
cd .. && zip -r lambda-deployment.zip backend/
aws s3 cp lambda-deployment.zip s3://[deployment-bucket]/
aws cloudformation deploy --template-file xobcat-backend/template.yaml \
  --stack-name xobcat-backend \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides FrontendUrl="https://main.d72hemfmh671a.amplifyapp.com" \
  --region us-east-2 \
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
./deploy-backend.sh

# 3. No frontend changes needed (API URL stays same)
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
```bash
# Lambda function logs
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/xobcat-backend" \
  --region us-east-2 \
  --profile ken-at-kore

# Tail recent logs
aws logs tail /aws/lambda/xobcat-backend-ApiFunction-* \
  --follow \
  --region us-east-2 \
  --profile ken-at-kore
```

### Health Checks
```bash
# Frontend health
curl https://main.d72hemfmh671a.amplifyapp.com

# Backend health
curl https://yp9om1wit1.execute-api.us-east-2.amazonaws.com/health
```

## 🔐 Security & Configuration

### Environment Variables
- **Frontend**: Set in Amplify Console
- **Backend**: Set in CloudFormation template
- **OpenAI API Keys**: User-provided at runtime (not stored in infrastructure)

### CORS Configuration
- **Allowed Origin**: `https://main.d72hemfmh671a.amplifyapp.com`
- **Configured in**: `backend/src/app.ts`

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

### Recovery Commands
```bash
# Redeploy frontend
aws amplify start-job --app-id d72hemfmh671a --branch-name main --job-type RELEASE --region us-east-2 --profile ken-at-kore

# Redeploy backend
./deploy-backend.sh

# Check both services
curl https://main.d72hemfmh671a.amplifyapp.com
curl https://yp9om1wit1.execute-api.us-east-2.amazonaws.com/health
```

## 📝 Notes

- **Profile Requirement**: Always use `--profile ken-at-kore` for AWS CLI commands
- **Region Lock**: All resources in `us-east-2` (Ohio)
- **Monorepo Structure**: Frontend in `/frontend`, backend in `/backend`, shared code in `/shared`
- **Auto-deploy**: Frontend auto-deploys on git push, backend requires manual deployment
- **Cost**: Serverless architecture, pay-per-use pricing
- **Scaling**: Auto-scales based on demand

---

*Last updated: July 30, 2025*
*Deployment architecture: Amplify (SSR) + Lambda + API Gateway*