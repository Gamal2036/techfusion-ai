FROM rust:1.96.0 AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY rust-toolchain.toml ./
COPY src/ ./src/
RUN cargo build --release

FROM debian:trixie-slim
WORKDIR /app
COPY --from=builder /app/target/release/agent /app/agent
CMD ["/app/agent"]
