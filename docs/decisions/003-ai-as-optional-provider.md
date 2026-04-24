# ADR 003: AI as Optional Provider

AI is modeled behind an interchangeable provider interface.

The default implementation is rule-based, deterministic and free. Ollama support is optional and disabled unless `OLLAMA_ENABLED=true`. This avoids paid API dependencies and keeps the analysis pipeline functional without local model infrastructure.
