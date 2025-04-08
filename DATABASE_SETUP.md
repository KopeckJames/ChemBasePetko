# Database Setup Guide for ChemSearch

This document provides instructions for setting up the databases required for ChemSearch.

## Database Requirements

ChemSearch uses two databases:
1. **Supabase** - For relational data storage
2. **Weaviate** - For vector search capabilities

## Environment Configuration

Create a `.env` file in the root directory with the following variables:

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
WEAVIATE_URL=your_weaviate_url
WEAVIATE_API_KEY=your_weaviate_api_key
WEAVIATE_SCHEME=https
OPENAI_API_KEY=your_openai_api_key (optional, for better vector search)
```

## Supabase Setup

1. Create an account on [Supabase](https://supabase.com) if you don't have one
2. Create a new project and note the URL and API key
3. Set up the database tables using the SQL script:
   
   Either:
   - Copy and run the SQL from `scripts/supabase-setup.sql` in the Supabase SQL Editor
   - Or run the script directly using the Supabase CLI if you have it installed

   This script creates:
   - The `users` and `compounds` tables
   - Required indexes for performance
   - A utility function for connection testing
   - Row-level security policies

## Weaviate Setup

1. Create an account on [Weaviate Cloud Services](https://console.weaviate.cloud/) if you don't have one
2. Create a new cluster (the free tier is sufficient for testing)
3. Note the URL and API key for your cluster
4. The application will automatically create the schema on startup

## Data Loading

To load chemical compound data into your databases:

1. Prepare your compound data in JSON format (see examples in the `examples` directory)
2. Use the provided upload script:
   ```
   ./scripts/upload-compounds.sh path/to/your/data
   ```

For more detailed instructions on data uploading, see the [UPLOAD_GUIDE.md](UPLOAD_GUIDE.md) file.

## Example Data

The `examples` directory contains sample compound data you can use to test the system:

```
./scripts/upload-compounds.sh --test
```

This will upload the example compounds (aspirin, caffeine, etc.) to your database.

## Testing Your Setup

To verify that your database setup is working correctly:

1. Start the application using the "Start application" workflow
2. Open the application in your browser
3. Try searching for compounds using keywords like "aspirin" or "caffeine"
4. If you've set up OpenAI integration, try semantic searches like "pain reliever" or "stimulant"

## Troubleshooting

If you encounter issues:

1. Check your environment variables and database credentials
2. Ensure your databases are accessible from your development environment
3. Look for any error messages in the application logs
4. Try running the SQL script again to ensure all database objects are created properly
5. Make sure the version() function exists in your Supabase database (this is used for connection testing)
