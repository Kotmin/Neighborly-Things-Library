# Neighborly Things Library - Context and Structure

## Overview

Neighborly Things Library is a Ruby on Rails application designed for managing a library of items that can be borrowed and returned. It provides an API for handling items, loans, and returns.

## Technology Stack

- **Ruby Version**: 3.4.7
- **Rails Version**: ~> 8.1.1
- **Database**: SQLite3 (>= 2.1)
- **Web Server**: Puma (>= 5.0)
- **Caching**: Solid Cache
- **Background Jobs**: Solid Queue
- **WebSockets**: Solid Cable
- **Deployment**: Kamal
- **Asset Serving**: Thruster
- **Image Processing**: image_processing (~> 1.2)
- **Testing Framework**: RSpec
- **Code Quality**: RuboCop (Rails Omkase), Brakeman, Bundler Audit

## Key Dependencies

- **Production**: rails, sqlite3, puma, solid_cache, solid_queue, solid_cable, bootsnap, kamal, thruster, image_processing
- **Development/Test**: debug, bundler-audit, brakeman, rubocop-rails-omakase

## Project Structure

The application follows standard Rails conventions with the following crucial parts:

### Root Level

- `Gemfile` / `Gemfile.lock`: Dependency management
- `Rakefile`: Rails tasks
- `config.ru`: Rack configuration
- `Dockerfile`: Multi-stage Docker build for production
- `docker-compose.yml`: Development and test environments
- `.ruby-version`: Ruby version specification (3.4.7)
- `.rspec`: RSpec configuration
- `.rubocop.yml`: Code style configuration

### App Directory (`app/`)

- `controllers/`: API controllers for items, loans, returns, and health checks
  - `application_controller.rb`: Base controller
  - `health_controller.rb`: Health check endpoint
  - `api/`: API-specific controllers
    - `items_controller.rb`
    - `loans_controller.rb`
    - `returns_controller.rb`
- `models/`: Data models
  - `application_record.rb`: Base model
  - `item.rb`: Item model
  - `loan.rb`: Loan model
- `services/`: Business logic services
  - `loans/`: Loan-related services
    - `borrow.rb`
    - `return.rb`
- `jobs/`: Background jobs
- `mailers/`: Email handling
- `views/`: View templates (minimal for API app)

### Config Directory (`config/`)

- `application.rb`: Main application configuration
- `database.yml`: Database configuration
- `routes.rb`: Routing configuration
- `environments/`: Environment-specific configs (development, production, test)
- `initializers/`: Rails initializers (CORS, parameter logging, etc.)

### Database (`db/`)

- `schema.rb`: Database schema
- `seeds.rb`: Seed data
- `migrate/`: Database migrations
  - `20260115140719_create_items.rb`
  - `20260115140721_create_loans.rb`

### Tests (`spec/`)

- `rails_helper.rb`: RSpec configuration for Rails
- `spec_helper.rb`: General RSpec setup
- `factories/`: FactoryBot factories for test data
  - `items.rb`
- `requests/`: Request specs
  - `health_spec.rb`
  - `loans_spec.rb`

### Scripts and Tools (`bin/`)

- `rails`, `rake`: Standard Rails executables
- `brakeman`, `bundler-audit`, `rubocop`: Security and code quality tools
- `kamal`: Deployment tool
- `ci`, `setup`: Custom scripts

### Kubernetes (`k8s/`)

- Deployment manifests for Kubernetes (namespace, configmap, secret, services, deployments, ingress, network policy)

## Docker Configuration

### Dockerfile

- **Base Image**: ruby:3.4.7-slim
- **Multi-stage Build**: base, build, prod
- **Production Optimizations**: jemalloc, bootsnap precompilation
- **User**: Non-root (rails:1000)
- **Exposed Port**: 80
- **Command**: `./bin/thrust ./bin/rails server`

### Docker Compose

- **Services**:
  - `app`: Development server on port 3000, with volume mounts for code, bundle, and SQLite DB
  - `test`: Test environment with volume mounts
- **Volumes**: bundle_cache, sqlite_dev, sqlite_test
- **Health Checks**: For both app and test services

## Testing

- **Framework**: RSpec
- **Structure**: Request specs in `spec/requests/`, factories in `spec/factories/`
- **CI**: GitHub Actions workflow in `.github/workflows/ci.yml`
- **Tools**: Brakeman for security, Bundler Audit for vulnerabilities, RuboCop for style

## Deployment

- **Tool**: Kamal for containerized deployment
- **Configuration**: `config/deploy.yml`, `.kamal/` directory with secrets and hooks
- **Kubernetes**: Manifests in `k8s/` for orchestrated deployment

## Development Setup

1. Ensure Ruby 3.4.7 is installed
2. `bundle install`
3. `rails db:migrate`
4. `rails server` or use Docker Compose for containerized development

## API Endpoints

- Health check: `/healthz`
- Items: `/api/items`
- Loans: `/api/loans`
- Returns: `/api/returns`

This context provides the necessary information for agents to understand and work efficiently with the Neighborly Things Library application.
