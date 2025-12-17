# Personal Job Board

A simple, file-based job tracking application with AI-powered job parsing. Built with Next.js App Router.

## Features

- **AI-Powered Parsing**: Paste a job URL and automatically extract title, company, location, and more using GPT-4o-mini
- **Evidence-Based Extraction**: Anti-hallucination validation ensures extracted data is grounded in the source text
- **File-Based Storage**: All data stored in markdown files - no database needed
- **Custom Columns**: Add your own tracking fields (text, checkbox, dropdown)
- **Status Tracking**: Track application status (Saved → Applied → Interview → Offer → Rejected)

## Setup

### Prerequisites

- Node.js 18+ or Bun
- OpenAI API key

### Installation

```bash
# Clone and install dependencies
bun install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your OPENAI_API_KEY

# Run the development server
bun dev
```

### Environment Variables

Create a `.env.local` file with:

```
OPENAI_API_KEY=sk-your-api-key-here
```

## Usage

### Creating a Board

1. Create a markdown file in `content/boards/`:

```bash
mkdir -p content/boards
```

2. Create `content/boards/yourname.md`:

```markdown
---
title: Your Name's Job Board
columns: []
---

# Your Name's Job Board

Personal job tracking board.

## Saved
```

3. Visit `http://localhost:3000/b/yourname`

### Adding Jobs

1. Paste a job posting URL in the input field
2. Click "Parse job" to extract job details
3. Review the preview (verified fields are highlighted)
4. Click "Add to board" to save

### Tracking Status

Each job card has controls for:

- **Applied**: Checkbox to mark if you've applied
- **Status**: Dropdown (Saved, Applied, Interview, Offer, Rejected)
- **Custom fields**: Any columns you've added

### Custom Columns

Click "+ Add custom column" to create:

- **Text**: Free-form text input (e.g., Salary, Notes)
- **Checkbox**: Yes/No toggle (e.g., Referral, Remote OK)
- **Dropdown**: Select from predefined options (e.g., Priority: Low/Medium/High)

## File Structure

```
content/boards/        # Markdown board files
app/
  b/[slug]/page.tsx   # Board page
  api/
    parse-job/        # Parse job URL
    add-job/          # Add job to board
    update-job/       # Update job fields
    delete-job/       # Delete a job
    add-column/       # Add custom column
lib/
  fetchPage.ts        # Fetch and clean web pages
  extractJob.ts       # OpenAI extraction
  validateExtraction.ts # Anti-hallucination validation
  markdown.ts         # Markdown parsing/formatting
```

## Deployment

Deploy to Vercel:

```bash
vercel
```

Make sure to set the `OPENAI_API_KEY` environment variable in your Vercel project settings.

**Note**: On Vercel, the `content/boards/` directory is read-only after deployment. For persistent storage in production, consider using Vercel Blob Storage or a database.

## Limitations

- **Static HTML only**: JavaScript-heavy job sites may not parse correctly
- **No authentication**: Anyone with the URL can view/edit a board
- **File-based**: Not suitable for high-traffic production use
- **Vercel deployment**: File writes work in development but not in production on Vercel's serverless functions

## License

MIT
