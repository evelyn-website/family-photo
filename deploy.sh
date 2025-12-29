#!/bin/bash

set -e  # Exit on error

echo "🚀 Starting production deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Deploy Convex backend
echo -e "${BLUE}📦 Step 1: Deploying Convex backend...${NC}"
if npx convex deploy -y; then
    echo -e "${GREEN}✅ Convex backend deployed successfully${NC}"
else
    echo -e "${YELLOW}❌ Convex deployment failed${NC}"
    exit 1
fi

echo ""

# Step 2: Deploy Vercel frontend
echo -e "${BLUE}🌐 Step 2: Deploying Vercel frontend...${NC}"
if vercel --prod --yes; then
    echo -e "${GREEN}✅ Vercel frontend deployed successfully${NC}"
else
    echo -e "${YELLOW}❌ Vercel deployment failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "  • Verify environment variables are set in Convex Dashboard"
echo "  • Verify VITE_CONVEX_URL is set in Vercel Dashboard"
echo "  • Test your production deployment"

