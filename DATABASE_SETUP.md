# Database Setup Guide

This document provides detailed instructions for setting up the database connections required for the Chemical Vector Database project.

## Prerequisites

- Node.js and npm installed
- A Supabase account and project
- A Weaviate instance (cloud or self-hosted)

## Environment Variables

The application requires the following environment variables to be set:

### Supabase Configuration

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-key
```

- `SUPABASE_URL`: The URL of your Supabase project
- `SUPABASE_KEY`: Your Supabase service role key (or anon key with appropriate permissions)

### Weaviate Configuration

```
WEAVIATE_URL=your-weaviate-cluster-url.weaviate.network
WEAVIATE_SCHEME=https
WEAVIATE_API_KEY=your-weaviate-api-key
```

- `WEAVIATE_URL`: The URL of your Weaviate instance (without the scheme)
- `WEAVIATE_SCHEME`: The scheme to use (http or https)
- `WEAVIATE_API_KEY`: Your Weaviate API key (if authentication is enabled)

## Setup Options

### Option 1: Using the Setup Script

We provide a convenient setup script that guides you through the database setup process:

1. Run the setup script:

```bash
./scripts/setup-database.sh
```

2. Follow the prompts to set up your environment variables and test your database connections.

### Option 2: Manual Setup

1. Create a `.env` file in the project root directory with the environment variables listed above.

2. Test your database connections:

```bash
npx tsx scripts/test-database-connections.ts
```

3. Initialize the database schema and upload example data (optional):

```bash
# Upload example compound data
npx tsx scripts/upload-local-compounds.ts ./examples
```

4. Test the semantic search functionality:

```bash
npx tsx scripts/test-semantic-search.ts
```

## Troubleshooting

### Common Issues

1. **Connection Error with Supabase**
   - Verify that your Supabase URL and key are correct
   - Ensure that your Supabase project is active and not in maintenance mode
   - Check that your network allows connections to Supabase

2. **Connection Error with Weaviate**
   - Verify that your Weaviate URL, scheme, and API key are correct
   - Ensure that your Weaviate instance is running and accessible
   - Check that the Weaviate client configuration matches your instance configuration

3. **Authentication Issues**
   - For Supabase, make sure you're using the service role key or an anon key with appropriate permissions
   - For Weaviate, check that your API key has the necessary permissions

4. **Schema Creation Failures**
   - If schema creation fails, check the console logs for specific errors
   - Try manually creating the schema using the Weaviate console or API

## Database Architecture

### Supabase

The application uses Supabase as a relational database to store structured information about chemical compounds. The schema includes:

- `compounds` table: Stores metadata about chemical compounds (IDs, names, formulas, etc.)
- `users` table: Stores user information (if applicable)

### Weaviate

Weaviate is used as a vector database for semantic search capabilities. The schema includes:

- `Compound` class: Stores chemical compound data with vector embeddings for semantic search

## Advanced Configuration

For advanced configuration options, please refer to the database client documentation:

- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Weaviate TypeScript Client](https://weaviate.io/developers/weaviate/client-libraries/typescript)
