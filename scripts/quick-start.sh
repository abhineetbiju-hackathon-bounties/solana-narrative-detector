#!/bin/bash

# Solana Narrative Detector - Quick Start Script
# This script will collect data, run analysis, and start the dashboard

set -e

echo "🚀 Solana Narrative Detector - Quick Start"
echo "==========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js $(node --version) detected"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data/raw data/processed
echo ""

# Check for .env file
if [ ! -f ".env.local" ]; then
    echo "⚠️  No .env.local file found. Creating from .env.example..."
    cp .env.example .env.local
    echo "   Please edit .env.local with your API keys for better results."
    echo ""
fi

# Collect data
echo "🔍 Step 1: Collecting data from all sources..."
echo "   This may take 2-3 minutes..."
npm run collect
echo ""

# Analyze data
echo "🧠 Step 2: Analyzing signals and generating narratives..."
npm run analyze
echo ""

# Check if narratives were generated
if [ -f "data/processed/narratives.json" ]; then
    NARRATIVE_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('data/processed/narratives.json', 'utf-8')).narratives.length)")
    echo "✅ Analysis complete! Detected $NARRATIVE_COUNT narratives"
    echo ""
else
    echo "⚠️  No narratives generated. Check the logs above for errors."
    echo ""
fi

# Start development server
echo "🌐 Step 3: Starting web dashboard..."
echo "   Dashboard will be available at http://localhost:3000"
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""

npm run dev
