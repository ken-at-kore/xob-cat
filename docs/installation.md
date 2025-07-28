# XOB CAT Installation Guide

## 🚀 Quick Start

Get XOB CAT up and running in under 10 minutes!

## 📋 Prerequisites

### Required Software
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher (comes with Node.js)
- **Git**: For cloning the repository

### Optional Software
- **VS Code**: Recommended IDE with TypeScript support
- **Postman**: For API testing
- **Docker**: For containerized development (future)

### System Requirements
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space
- **OS**: macOS, Windows, or Linux

## 🔧 Installation Steps

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/kore-ai/xob-cat.git

# Navigate to the project directory
cd XOB CAT
```

### Step 2: Install Dependencies

```bash
# Install all dependencies (frontend + backend)
npm run install:all

# Or install individually:
npm install                    # Root dependencies
cd frontend && npm install     # Frontend dependencies
cd ../backend && npm install   # Backend dependencies
```

### Step 3: Environment Configuration

#### Backend Environment
```bash
# Copy the example environment file
cp backend/env.example backend/.env

# Edit the environment file
nano backend/.env
```

**Required Environment Variables:**
```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# OpenAI Configuration (Required for analysis features)
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Kore.ai Configuration
# KORE_BOT_ID=your_bot_id
# KORE_CLIENT_ID=your_client_id
# KORE_CLIENT_SECRET=your_client_secret
```

#### Frontend Environment (Optional)
```bash
# Copy the example environment file
cp frontend/.env.example frontend/.env.local

# Edit the environment file
nano frontend/.env.local
```

**Frontend Environment Variables:**
```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Step 4: Kore.ai Configuration (Optional)

If you want to use real Kore.ai data instead of mock data:

1. **Create Configuration File:**
   ```bash
   # Create the config directory
   mkdir -p backend/config
   
   # Create the bot configuration file
   nano backend/config/optum-bot.yaml
   ```

2. **Add Bot Credentials:**
   ```yaml
   kore:
     bot_id: "your-bot-id"
     client_id: "your-client-id"
     client_secret: "your-client-secret"
     base_url: "https://bots.kore.ai"
     name: "Your Bot Name"
   ```

   > ⚠️ **Security Note**: This file is excluded from git to protect credentials.

### Step 5: Verify Installation

```bash
# Check Node.js version
node --version  # Should be 18.0.0 or higher

# Check npm version
npm --version   # Should be 8.0.0 or higher

# Verify dependencies are installed
npm list --depth=0
```

## 🚀 Starting the Application

### Development Mode

```bash
# Start both frontend and backend
npm run start

# Or start individually:
npm run start:frontend   # Frontend only (port 3000)
npm run start:backend    # Backend only (port 3001)

# Stop servers:
npm run stop            # Stop both servers
npm run stop:frontend   # Stop frontend only
npm run stop:backend    # Stop backend only
```

### Verify Everything is Working

1. **Frontend**: Open http://localhost:3000
2. **Backend Health Check**: Open http://localhost:3001/health
3. **API Test**: Open http://localhost:3001/api/sessions

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
cd backend && npm test
cd frontend && npm test
```

## 🔧 Development Tools

### Recommended VS Code Extensions

1. **TypeScript and JavaScript Language Features**
2. **ESLint**
3. **Prettier - Code formatter**
4. **Tailwind CSS IntelliSense**
5. **Thunder Client** (for API testing)

### VS Code Settings

Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  }
}
```

## 🐛 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Check what's using the port
lsof -i :3001
lsof -i :3000

# Kill the process
kill -9 <PID>
```

#### Node.js Version Issues
```bash
# Install Node Version Manager (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node.js 18
nvm install 18
nvm use 18
```

#### Dependency Issues
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Environment Variables Not Loading
```bash
# Check if .env file exists
ls -la backend/.env

# Verify environment variables are loaded
cd backend && npm run start
```

### Getting Help

1. **Check the logs** for error messages
2. **Verify prerequisites** are installed correctly
3. **Check environment variables** are set properly
4. **Search existing issues** on GitHub
5. **Create a new issue** with detailed information

## 🔒 Security Considerations

### Environment Variables
- Never commit `.env` files to version control
- Use strong, unique API keys
- Rotate credentials regularly
- Use different keys for development and production

### File Permissions
```bash
# Set proper permissions for config files
chmod 600 backend/config/*.yaml
chmod 600 backend/.env
```

## 📦 Production Deployment

### Building for Production

```bash
# Build both frontend and backend
npm run build

# Or build individually:
npm run build:frontend
npm run build:backend
```

### Deployment Options

1. **Vercel** (Frontend) + **AWS Lambda** (Backend)
2. **Netlify** (Frontend) + **Heroku** (Backend)
3. **AWS S3 + CloudFront** (Frontend) + **AWS Fargate** (Backend)
4. **Docker** containers (future)

## 🔄 Updates and Maintenance

### Updating Dependencies
```bash
# Check for outdated packages
npm outdated

# Update dependencies
npm update

# Update to latest versions (use with caution)
npx npm-check-updates -u && npm install
```

### Database Migrations (Future)
```bash
# Run database migrations
npm run migrate

# Seed development data
npm run seed
```

## 📚 Next Steps

After installation:

1. **Read the [User Manual](./user-manual.md)** to understand the features
2. **Check the [API Reference](./api-reference.md)** for integration details
3. **Review the [Development Guide](./development.md)** for contributing
4. **Explore the [Architecture Overview](./architecture.md)** for system design

## 🆘 Support

If you encounter issues:

1. **Check this installation guide** for common solutions
2. **Review the [Troubleshooting Guide](./troubleshooting.md)**
3. **Search existing issues** on GitHub
4. **Create a new issue** with:
   - Operating system and version
   - Node.js and npm versions
   - Error messages and logs
   - Steps to reproduce the issue

---

**Installation Guide Version:** 1.0  
**Last Updated:** July 2025  
**Maintained by:** Kore.ai Expert Services Team 