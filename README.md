# ChemBasePetko

A chemical compound vector database leveraging Weaviate for advanced natural language queries, with a React frontend for intuitive data exploration.

## Project Overview

ChemBasePetko enables semantic search of chemical compounds from the PubChem database, allowing users to find compounds based on natural language descriptions, chemical properties, and structural similarities.

## Key Features

- **Vector Search**: Semantic search capabilities using Weaviate vector database
- **PubChem Integration**: Automated downloading and processing of compound data from PubChem
- **Natural Language Queries**: Find compounds using plain language descriptions
- **Scalable Architecture**: Designed to handle 144,000+ compounds with batch processing
- **React Frontend**: Modern, responsive user interface for intuitive data exploration

## Technical Stack

- **Frontend**: React, TailwindCSS, shadcn/ui
- **Backend**: Node.js, Express
- **Database**: Weaviate vector database
- **API Integration**: PubChem REST API

## Getting Started

1. Clone this repository
2. Install dependencies with `npm install`
3. Start the application with `npm run dev`
4. Access the application at http://localhost:5000

## Data Processing

The application includes scripts for:
- Batch downloading compounds from PubChem
- Processing and loading compounds into Weaviate
- Tracking download progress and handling rate limits

## License

MIT
