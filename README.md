# Chemical Vector Database

A cutting-edge chemical compound vector database that leverages advanced semantic search technologies to provide an intuitive and interactive research experience.

## Features

- **Vector-Based Semantic Search**: Query compounds by concept rather than just keywords
- **PubChem Integration**: Upload compound data from PubChem or other sources
- **React-Based Interactive UI**: Modern, responsive interface for exploring compounds
- **Dual Database Architecture**:
  - Supabase PostgreSQL for structured data storage
  - Weaviate Vector Database for semantic search capabilities
- **Batch Processing**: Efficiently handle large datasets with progress tracking

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- Supabase account and project
- Weaviate instance (cloud or self-hosted)
- OpenAI API key (for text embeddings)

### Environment Setup

Create a `.env` file in the root directory with your API credentials:

```
# Supabase credentials
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Weaviate credentials
WEAVIATE_URL=your_weaviate_url
WEAVIATE_SCHEME=https
WEAVIATE_API_KEY=your_weaviate_api_key

# Optional: For text2vec-openai vectorizer
OPENAI_API_KEY=your_openai_api_key
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your database (see [DATABASE_SETUP.md](DATABASE_SETUP.md))
4. Start the development server:
   ```bash
   npm run dev
   ```

## Uploading Compounds

You can upload chemical compound data from local JSON files. See [UPLOAD_GUIDE.md](UPLOAD_GUIDE.md) for detailed instructions.

### Quick Start

To test the upload functionality with example compounds:

```bash
./scripts/run-test-upload.sh
```

To upload your own data:

```bash
npx tsx scripts/upload-local-compounds.ts --file /path/to/compound.json
# or
npx tsx scripts/upload-local-compounds.ts --directory /path/to/directory
```

## Database Testing

Verify your database connections:

```bash
npx tsx scripts/test-database-connections.ts
```

Test semantic search functionality:

```bash
npx tsx scripts/test-semantic-search.ts
```

## Working with the API

### Semantic Search Example

```typescript
// Client-side search request
const response = await fetch('/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "anti-inflammatory compounds",
    searchType: "semantic",
    sort: "relevance",
    page: 1,
    limit: 10
  })
});

const results = await response.json();
```

## Project Structure

- `client/` - React frontend
- `server/` - Express backend
- `scripts/` - Utility scripts for database operations
- `shared/` - Shared types and schemas
- `examples/` - Example compound data files

## Architecture

### Data Flow

1. Compounds are uploaded from local JSON files to Supabase
2. Compound data is then processed and stored in Weaviate for semantic search
3. The frontend queries the backend API for search results
4. The backend retrieves relevant compounds using vector similarity search

### Database Schema

The system uses a dual-database approach:

- **Supabase** stores the full compound records with all properties
- **Weaviate** stores vectors generated from compound text fields for semantic search

## Documentation

- [Database Setup Guide](DATABASE_SETUP.md) - Instructions for setting up the databases
- [Upload Guide](UPLOAD_GUIDE.md) - How to upload compound data

## License

MIT