#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================================${NC}"
echo -e "${BLUE}    Chemical Vector Database - Test Upload Script        ${NC}"
echo -e "${BLUE}=========================================================${NC}"
echo ""

# Check if examples directory exists
if [ ! -d "examples" ]; then
    echo -e "${RED}Error: examples directory not found.${NC}"
    echo -e "Please run this script from the project root directory."
    exit 1
fi

# Count example files
example_count=$(ls examples/*.json 2>/dev/null | wc -l)

if [ "$example_count" -eq 0 ]; then
    echo -e "${RED}Error: No JSON files found in the examples directory.${NC}"
    exit 1
fi

echo -e "${BLUE}Found ${example_count} example compounds to upload.${NC}"
echo ""

# Test database connections first
echo -e "${BLUE}Testing database connections...${NC}"
npx tsx scripts/test-database-connections.ts

if [ $? -ne 0 ]; then
    echo -e "${RED}Database connection test failed. Cannot proceed with upload.${NC}"
    echo -e "${YELLOW}Please check your database connections and try again.${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Uploading example compounds...${NC}"
npx tsx scripts/upload-local-compounds.ts ./examples

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}Example compounds successfully uploaded!${NC}"
    
    # Ask if user wants to test semantic search
    echo -e "${YELLOW}Would you like to test the semantic search functionality?${NC} (y/n)"
    read test_search
    
    if [ "$test_search" == "y" ] || [ "$test_search" == "Y" ]; then
        echo ""
        echo -e "${BLUE}Testing semantic search...${NC}"
        npx tsx scripts/test-semantic-search.ts
    fi
    
    echo ""
    echo -e "${GREEN}Setup complete! You can now start the application.${NC}"
else
    echo ""
    echo -e "${RED}Upload failed. Check the error messages above.${NC}"
fi
