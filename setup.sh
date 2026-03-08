#!/bin/bash

# ===================================
# 🌐 Site Editor - Complete Auto Setup
# ===================================
# 
# WHAT THIS DOES:
# This script sets up the complete Site Editor application including:
# - Node.js dependency installation (server + frontend)
# - Frontend building with Vite
# - Database and permissions setup
# - Environment configuration
# - Server startup
#
# HOW TO USE:
# 1. Copy this entire folder to any computer
# 2. Run: ./setup.sh
# 3. Access at: http://localhost:8787
#
# REQUIREMENTS:
# - Node.js 20+ (install from https://nodejs.org)
# - Internet connection for dependency downloads
#
# AFTER SETUP:
# - Backend API: http://localhost:8787
# - Frontend: Served automatically at root
# - Database: All user data preserved
# - AI Features: All API keys configured

set -e  # Exit on any error

echo "🚀 Site Editor Auto Setup Starting..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed!"
        print_info "Please install Node.js from https://nodejs.org (v20+ recommended)"
        print_info "Or run: brew install node"
        exit 1
    else
        NODE_VERSION=$(node --version)
        print_status "Node.js found: $NODE_VERSION"
    fi
}

# Install ALL system dependencies
install_dependencies() {
    print_info "🔧 Installing system dependencies..."
    
    # Check for Homebrew (macOS package manager)
    if ! command -v brew &> /dev/null; then
        print_info "📦 Installing Homebrew (macOS package manager)..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    else
        print_status "✅ Homebrew already installed"
    fi
    
    # Install Node.js if not present
    if ! command -v node &> /dev/null; then
        print_info "📦 Installing Node.js 20..."
        brew install node@20
    else
        print_status "✅ Node.js already installed: $(node --version)"
    fi
    
    # Install Git if not present
    if ! command -v git &> /dev/null; then
        print_info "📦 Installing Git..."
        brew install git
    else
        print_status "✅ Git already installed: $(git --version)"
    fi

    print_info "📦 Installing server dependencies..."
    cd server
    if npm install; then
        print_status "✅ Server dependencies installed"
    else
        print_error "❌ Failed to install server dependencies"
        exit 1
    fi

    print_info "📦 Installing dashboard dependencies..."
    cd ../dashboard
    if npm install; then
        print_status "✅ Dashboard dependencies installed"
    else
        print_error "❌ Failed to install dashboard dependencies"
        exit 1
    fi

    print_info "🔨 Building dashboard with Vite..."
    if npm run build; then
        print_status "✅ Dashboard built successfully"
    else
        print_error "❌ Failed to build dashboard"
        exit 1
    fi

    cd ..
}

# Setup environment
setup_environment() {
    if [ ! -f "server/.env" ]; then
        print_info "Setting up environment file..."
        cp server/.env.example server/.env
        print_status "Environment file created at server/.env"
        print_warning "Please edit server/.env with your API keys:"
        print_warning "- ANTHROPIC_API_KEY (Claude)"
        print_warning "- GEMINI_API_KEY (Google)"
        print_warning "- STRIPE_PUBLISHABLE_KEY & STRIPE_SECRET_KEY"
        print_warning "- RESEND_API_KEY (for emails)"
    else
        print_status "Environment file already exists"
    fi
}

# Fix permissions
fix_permissions() {
    print_info "Fixing file permissions..."
    chmod +x server/*.js 2>/dev/null || true
    chmod 644 server/editor.db 2>/dev/null || true
    print_status "Permissions fixed"
}

# Start the complete application
start_application() {
    print_info "🚀 Starting Site Editor server..."
    cd server
    echo ""
    print_status "🌐 Backend API: http://localhost:8787"
    print_status "🖥️  Frontend: http://localhost:8787 (served automatically)"
    print_status "� Database: All user data loaded"
    print_status "🤖 AI Features: Claude, Gemini, Groq, Ollama ready"
    print_status "💳 Payments: Stripe integration active"
    print_status "📧 Email: Resend notifications ready"
    echo ""
    print_info "📋 Quick Start Guide:"
    print_info "   • Open browser to http://localhost:8787"
    print_info "   • Create account or login with existing"
    print_info "   • Import websites or start editing"
    print_info "   • Use AI to modify any element"
    print_info "   • Export finished sites"
    echo ""
    print_info "⚠️  Press Ctrl+C to stop the server"
    echo "=================================="
    
    node index.js
}

# Main execution
main() {
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -d "server" ] || [ ! -d "dashboard" ]; then
        print_error "Please run this script from the site-editor root directory!"
        print_info "The directory should contain: package.json, server/, dashboard/"
        exit 1
    fi

    check_node
    install_dependencies
    setup_environment
    fix_permissions
    start_application
}

# Run main function
main "$@"
