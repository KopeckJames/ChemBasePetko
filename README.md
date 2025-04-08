# ChemBasePetko

A chemical compound vector database leveraging Weaviate for advanced natural language queries, with a React frontend for intuitive data exploration.

## Project Overview

ChemBasePetko is a comprehensive platform for searching and exploring chemical compounds from the PubChem database. It utilizes vector embeddings and semantic search capabilities to enable natural language queries about chemical properties, structures, and uses.

### Key Features

- **Semantic Search**: Natural language queries powered by Weaviate vector database
- **PubChem Integration**: Data sourced directly from the PubChem API
- **React Frontend**: Intuitive user interface for exploring compound data
- **Scalable Architecture**: Handles large datasets with batch processing
- **Progress Tracking**: Comprehensive download and processing progress monitoring

## Technical Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Node.js, Express
- **Vector Database**: Weaviate
- **Data Source**: PubChem API

## Data Processing

The application includes scripts for:

1. Downloading compounds from PubChem API with rate limiting
2. Processing and extracting relevant compound information
3. Loading data into both standard and vector databases
4. Monitoring download and processing progress

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Start the development server with `npm run dev`
4. Access the application at http://localhost:5000

## Scripts

- `batch-download-compounds.ts`: Download compounds in batches
- `load-compounds.ts`: Load downloaded compounds into databases
- `check-progress.ts`: Monitor download progress
- `test-semantic-search.ts`: Test semantic search functionality

## License

[MIT License](LICENSE)