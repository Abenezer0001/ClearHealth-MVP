# ClearHealth - Health Misinformation Detector

## Overview

ClearHealth is an AI-powered web application that detects health misinformation and generates evidence-based counter-messages. Users can submit health claims via text or URL, and the system extracts atomic claims, assigns risk scores, retrieves evidence from trusted medical sources, and generates tailored responses in multiple formats and lengths for different audiences.

The application serves as an educational tool with strong safety guardrails - it does not provide medical advice, filters out medication dosage information, and immediately redirects users to emergency services when critical symptoms are detected.

## Recent Changes (Feb 2026)
- Fixed critical bug: AI pipeline now updates existing claims instead of creating duplicates
- Added updateClaim method to storage interface
- Improved claim matching logic in risk assessment step
- All e2e tests passing: home page, analysis flow, history, admin dashboard

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled via Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Theme Support**: Light/dark mode with system preference detection

### Backend Architecture
- **Framework**: Express.js 5.x running on Node.js with TypeScript
- **Build Process**: esbuild for server bundling, Vite for client
- **API Pattern**: RESTful JSON APIs at `/api/*` endpoints
- **AI Integration**: OpenAI SDK via Replit AI Integrations for claim extraction, risk assessment, and response generation
- **Pipeline Design**: Asynchronous analysis pipeline with status polling - client polls `/api/analysis/:id` until completion

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` - single source of truth for database schema and Zod validation
- **Migrations**: Drizzle Kit with `db:push` command for schema synchronization
- **Key Tables**: analyses, claims, citations, generated_outputs, feedbacks, source_documents, example_inputs

### Key Design Decisions

**Shared Schema Pattern**: The `shared/` directory contains schema definitions used by both frontend and backend, enabling type-safe API contracts and consistent validation.

**Analysis Pipeline**: Long-running AI analysis runs asynchronously with status stored in database. Frontend polls for updates, displaying progress through a visual stepper component.

**Safety Guardrails**: Red flag detection for emergency symptoms triggers immediate safety responses. Dosage patterns are filtered from generated content to prevent misuse.

**Trusted Sources**: Curated source documents in database provide RAG context for evidence-based responses. In production, this would use vector search; current implementation uses direct text matching.

**Output Variants**: Generated responses come in multiple lengths (short/medium/long) and formats (social reply, patient handout, clinician note) to serve different use cases.

## External Dependencies

### AI Services
- **OpenAI API** via Replit AI Integrations (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`)
- Used for: claim extraction, risk scoring, evidence retrieval, counter-message generation

### Database
- **PostgreSQL** via `DATABASE_URL` environment variable
- Session storage uses `connect-pg-simple` for persistent sessions

### Key NPM Packages
- `drizzle-orm` + `drizzle-zod`: Database ORM with Zod schema generation
- `@tanstack/react-query`: Server state management
- `openai`: AI model integration
- `zod` + `zod-validation-error`: Runtime validation
- Full Radix UI primitive suite for accessible components

### Replit Integrations
- Audio processing utilities for voice features (available but not core to main flow)
- Image generation capabilities via `gpt-image-1` model
- Chat storage patterns for conversation persistence