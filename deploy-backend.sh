#!/bin/bash
set -e

# Configuration
STACK_NAME="xobcat-backend"
REGION="us-east-2"
PROFILE="ken-at-kore"
S3_BUCKET="xobcat-lambda-deployments-$(date +%s)"

echo "🚀 Deploying XOB CAT Backend to AWS Lambda..."

# Create S3 bucket for deployment artifacts
echo "📦 Creating deployment bucket..."
aws s3 mb s3://$S3_BUCKET --region $REGION --profile $PROFILE

# Build the backend
echo "🔨 Building backend..."
cd backend
npm run build:lambda

# Copy required dependencies from root node_modules to backend for Lambda
echo "📦 Preparing Lambda dependencies..."
mkdir -p node_modules
cp -r ../node_modules/aws-serverless-express node_modules/ 2>/dev/null || echo "aws-serverless-express not found in root"
cp -r ../node_modules/express node_modules/ 2>/dev/null || echo "express not found in root"
cp -r ../node_modules/cors node_modules/ 2>/dev/null || echo "cors not found in root"
cp -r ../node_modules/helmet node_modules/ 2>/dev/null || echo "helmet not found in root"
cp -r ../node_modules/morgan node_modules/ 2>/dev/null || echo "morgan not found in root"
cp -r ../node_modules/dotenv node_modules/ 2>/dev/null || echo "dotenv not found in root"
cp -r ../node_modules/openai node_modules/ 2>/dev/null || echo "openai not found in root"
cp -r ../node_modules/jsonwebtoken node_modules/ 2>/dev/null || echo "jsonwebtoken not found in root"
cp -r ../node_modules/uuid node_modules/ 2>/dev/null || echo "uuid not found in root"
cp -r ../node_modules/zod node_modules/ 2>/dev/null || echo "zod not found in root"

cd ..

# Create deployment package
echo "📁 Creating deployment package..."
cd backend
# Only include compiled code and production dependencies
zip -r ../lambda-deployment.zip \
  dist/ \
  node_modules/ \
  package.json \
  -x "node_modules/.cache/*" \
  "src/*" \
  "*.test.*" \
  "__tests__/*" \
  "node_modules/@types/*" \
  "node_modules/typescript/*" \
  "node_modules/eslint/*" \
  "node_modules/jest/*" \
  "node_modules/@eslint/*" \
  "node_modules/@typescript-eslint/*"
cd ..

# Upload to S3
echo "⬆️  Uploading to S3..."
aws s3 cp lambda-deployment.zip s3://$S3_BUCKET/ --profile $PROFILE

# Update CloudFormation template with S3 location
cd xobcat-backend
cp template.yaml template-deployed.yaml
sed -i '' "s|CodeUri: ../backend|CodeUri: s3://$S3_BUCKET/lambda-deployment.zip|g" template-deployed.yaml

# Deploy CloudFormation stack
echo "☁️  Deploying CloudFormation stack..."
aws cloudformation deploy \
  --template-file template-deployed.yaml \
  --stack-name $STACK_NAME \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    FrontendUrl="https://main.d72hemfmh671a.amplifyapp.com" \
  --region $REGION \
  --profile $PROFILE

# Get API URL
echo "🔗 Getting API URL..."
API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text \
  --region $REGION \
  --profile $PROFILE)

echo "✅ Deployment complete!"
echo "🌐 API URL: $API_URL"
echo "💡 Next steps:"
echo "   1. Update Amplify environment variable NEXT_PUBLIC_API_URL to: $API_URL"
echo "   2. Set your OpenAI API key in AWS Systems Manager Parameter Store"

# Cleanup
rm -f ../lambda-deployment.zip template-deployed.yaml