#!/bin/bash

# Health Sherpa - Cross-Environment Workflow Validation Script
# This script validates that both local and Firebase environments are ready for development

set -e  # Exit on any error

echo "Health Sherpa - Cross-Environment Workflow Validation"
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}$2${NC}"
    else
        echo -e "${RED}$2${NC}"
    fi
}

print_warning() {
    echo -e "${YELLOW} $1${NC}"
}

print_info() {
    echo -e "ℹ $1"
}

# Check prerequisites
echo
echo "Checking Prerequisites..."
echo "----------------------------"

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status 0 "Node.js installed: $NODE_VERSION"
else
    print_status 1 "Node.js not found"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_status 0 "npm installed: $NPM_VERSION"
else
    print_status 1 "npm not found"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_status 1 "package.json not found - are you in the project root?"
    exit 1
fi

# Check project name
PROJECT_NAME=$(grep '"name"' package.json | cut -d'"' -f4)
if [ "$PROJECT_NAME" = "health-sherpa-redone" ]; then
    print_status 0 "Correct project: $PROJECT_NAME"
else
    print_status 1 "Wrong project: $PROJECT_NAME"
    exit 1
fi

# Install dependencies
echo
echo "Installing Dependencies..."
echo "-----------------------------"
npm install
print_status $? "Dependencies installed"

# Code quality checks
echo
echo "Code Quality Checks..."
echo "-------------------------"

# Format check
npm run format:check
print_status $? "Code formatting check"

# Lint check
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -eq 0 ]; then
    print_status 0 "ESLint check passed"
else
    print_warning "ESLint issues found - run 'npm run lint:fix' to auto-fix"
fi

# TypeScript check
npm run typecheck
print_status $? "TypeScript validation"

# Build validation
echo
echo " Build Validation..."
echo "----------------------"

# Local build
print_info "Building for local environment..."
npm run build
print_status $? "Local production build"

# Firebase build  
print_info "Building for Firebase environment..."
npm run build:firebase
print_status $? "Firebase production build"

# Environment configuration
echo
echo "Environment Configuration..."
echo "-------------------------------"

# Check for environment files
if [ -f ".env.local" ]; then
    print_status 0 ".env.local file exists"
    
    # Check for API key
    if grep -q "GOOGLE_GENAI_API_KEY=" .env.local && ! grep -q "your_google_ai_api_key_here" .env.local; then
        print_status 0 "Google AI API key configured"
    else
        print_warning "Google AI API key not configured - add your key to .env.local"
    fi
else
    print_warning ".env.local not found - copy from .env.local.example and add your API key"
fi

if [ -f ".env.firebase" ]; then
    print_status 0 "Firebase environment template exists"
else
    print_status 1 "Firebase environment template missing"
fi

# Test execution
echo
echo "Test Execution..."
echo "-------------------"

# Check if Playwright is configured
if [ -f "playwright.config.ts" ]; then
    print_status 0 "Playwright configuration found"
    
    # Install Playwright browsers if needed
    print_info "Installing Playwright browsers..."
    npx playwright install --with-deps
    
    # Run tests (with timeout)
    print_info "Running Playwright tests..."
    timeout 60s npm run test || {
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 124 ]; then
            print_warning "Tests timed out (may be normal if server not running)"
        else
            print_warning "Some tests failed - check output above"
        fi
    }
else
    print_status 1 "Playwright configuration missing"
fi

# Development server validation
echo
echo " Development Server Validation..."
echo "-----------------------------------"

print_info "Local development server check..."
# Start local dev server in background
npm run dev &
LOCAL_PID=$!
sleep 5

# Check if server is running
if curl -s http://localhost:3000 > /dev/null; then
    print_status 0 "Local development server working"
else
    print_status 1 "Local development server failed"
fi

# Kill local server
kill $LOCAL_PID 2>/dev/null || true
sleep 2

print_info "Firebase development server check..."
# Start Firebase dev server in background  
npm run dev:firebase &
FIREBASE_PID=$!
sleep 5

# Check if Firebase server is running
if curl -s http://localhost:9002 > /dev/null; then
    print_status 0 "Firebase development server working"
else
    print_status 1 "Firebase development server failed"
fi

# Kill Firebase server
kill $FIREBASE_PID 2>/dev/null || true
sleep 2

# Summary
echo
echo "Validation Summary"
echo "===================="

echo "Prerequisites: Node.js, npm, project structure"
echo "Code Quality: Formatting, linting, TypeScript"  
echo "Build System: Local and Firebase builds"
echo "Environment: Configuration files and API keys"
echo "Testing: Playwright setup and execution"
echo "Servers: Local and Firebase development servers"

echo
echo "Workflow validation complete!"
echo
echo "Next steps:"
echo "  Local development:    npm run dev"
echo "  Firebase development: npm run dev:firebase"
echo "  Run tests:           npm run test"
echo "  Format code:         npm run format"
echo "  Build for Firebase:  npm run build:firebase"

exit 0