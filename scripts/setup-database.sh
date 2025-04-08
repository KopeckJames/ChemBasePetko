#!/bin/bash

# Chemical Vector Database - Database Setup Helper Script
# This script helps set up and verify the database connections required by the application

# Color codes for output formatting
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print header
echo -e "${BLUE}=========================================================${NC}"
echo -e "${BLUE}    Chemical Vector Database - Database Setup Helper    ${NC}"
echo -e "${BLUE}=========================================================${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}No .env file found. Creating from example...${NC}"
    
    # If .env.example exists, copy it
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}Created .env file from example.${NC}"
    else
        # Create a minimal .env file
        echo -e "${YELLOW}Creating minimal .env file...${NC}"
        cat > .env << EOF2
# Supabase configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Weaviate configuration
WEAVIATE_URL=your_weaviate_url
WEAVIATE_SCHEME=https
WEAVIATE_API_KEY=your_weaviate_api_key

# Optional: OpenAI API key for vectorization
# OPENAI_API_KEY=your_openai_api_key
EOF2
        echo -e "${GREEN}Created minimal .env file.${NC}"
    fi
    
    echo -e "${YELLOW}Please edit the .env file with your database credentials.${NC}"
    echo ""
    echo -e "Run ${BLUE}nano .env${NC} to edit the file."
    echo ""
    exit 0
fi

# Function to test database connections
test_connections() {
    echo -e "${BLUE}Testing database connections...${NC}"
    
    npx tsx scripts/test-database-connections.ts
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Database connection test failed.${NC}"
        echo -e "${YELLOW}Please check your environment variables and database credentials.${NC}"
        return 1
    fi
    
    return 0
}

# Main execution
echo -e "${BLUE}Testing database connections...${NC}"
test_connections

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${BLUE}Step 3: Verifying example data${NC}"
    echo -e "${YELLOW}Would you like to upload example compounds to verify the database works?${NC} (y/n)"
    read upload_examples

    if [ "$upload_examples" == "y" ] || [ "$upload_examples" == "Y" ]; then
        # Check if examples directory exists
        if [ -d "examples" ]; then
            echo -e "${BLUE}Uploading example compounds...${NC}"
            npx tsx scripts/upload-local-compounds.ts ./examples
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}Example compounds uploaded successfully!${NC}"
            else
                echo -e "${RED}Failed to upload example compounds.${NC}"
                echo -e "${YELLOW}Please check the error messages above.${NC}"
            fi
        else
            echo -e "${RED}Examples directory not found.${NC}"
            echo -e "${YELLOW}Skipping example upload.${NC}"
        fi
    fi

    echo ""
    echo -e "${BLUE}Step 4: Testing semantic search${NC}"
    echo -e "${YELLOW}Would you like to test the semantic search functionality?${NC} (y/n)"
    read test_search

    if [ "$test_search" == "y" ] || [ "$test_search" == "Y" ]; then
        echo -e "${BLUE}Running semantic search test...${NC}"
        npx tsx scripts/test-semantic-search.ts
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Semantic search test completed!${NC}"
        else
            echo -e "${RED}Semantic search test failed.${NC}"
            echo -e "${YELLOW}Please check the error messages above.${NC}"
        fi
    fi

    echo ""
    echo -e "${GREEN}=========================================================${NC}"
    echo -e "${GREEN}                      Setup Complete                     ${NC}"
    echo -e "${GREEN}=========================================================${NC}"
    echo ""
    echo -e "You can now start the application using the configured workflow."
    echo ""
fi

echo -e "If you encounter any issues, please refer to DATABASE_SETUP.md"
echo -e "or check the project repository for more information."
