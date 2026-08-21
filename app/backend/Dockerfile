# Use the official uv image
FROM ghcr.io/astral-sh/uv:python3.12-alpine AS builder

# Set the working directory
WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy project files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev

# Final stage
FROM python:3.12-alpine

WORKDIR /app

# Copy the virtual environment from the builder
COPY --from=builder /app/.venv /app/.venv

# Copy the application code
COPY . .

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Create logs directory and strip pip/setuptools from the runtime image
# (dependencies come exclusively from the uv-managed .venv — no pip in runtime)
RUN mkdir -p logs && pip uninstall --yes pip setuptools wheel || true

# Expose the application port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
