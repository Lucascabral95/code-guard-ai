# ADR 001: Use Redis Streams

Redis Streams are used instead of BullMQ because the main analyzer worker is written in Go.

BullMQ is excellent for Node.js workers, but it couples queue semantics to a Node-oriented library. Redis Streams provide consumer groups, acknowledgements and retry-friendly semantics using Redis primitives that both NestJS and Go can use directly.
