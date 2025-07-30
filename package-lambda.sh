#!/bin/bash
set -e

echo "📦 Creating focused Lambda deployment package..."

cd backend

# Build the app
echo "🔨 Building application..."
rm -rf dist
rm -rf src/shared
cp -r ../shared src/shared
tsc -p tsconfig.build.json
rm -rf src/shared

# Create clean deployment directory
rm -rf lambda-package
mkdir -p lambda-package

# Copy built code
cp -r dist lambda-package/
cp simple-lambda.js lambda-package/
cp package.json lambda-package/

# Install only production dependencies in the package
cd lambda-package
echo "📦 Installing production dependencies..."
npm install --only=production --no-optional

# Copy specific runtime dependencies from root that we need
mkdir -p node_modules/aws-serverless-express
cp -r ../../node_modules/aws-serverless-express/* node_modules/aws-serverless-express/ 2>/dev/null || echo "Copying aws-serverless-express"

echo "✅ Lambda package ready in backend/lambda-package/"
ls -la
echo "Contents:"
find . -name "*.js" | head -10