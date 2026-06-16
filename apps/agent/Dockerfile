FROM rust:1.80-alpine AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src/ ./src/
RUN apk add --no-cache musl-dev && cargo build --release

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/target/release/agent /app/agent
CMD ["/app/agent"]
