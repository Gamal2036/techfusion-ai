export class CircuitBreaker {
  private failures: Map<string, number> = new Map()
  private openUntil: Map<string, number> = new Map()
  private readonly threshold: number
  private readonly resetMs: number

  constructor(threshold = 3, resetMs = 600000) {
    this.threshold = threshold
    this.resetMs = resetMs
  }

  isOpen(providerName: string): boolean {
    const until = this.openUntil.get(providerName)
    if (until && Date.now() < until) return true
    if (until && Date.now() >= until) {
      this.openUntil.delete(providerName)
      this.failures.set(providerName, 0)
    }
    return false
  }

  recordFailure(providerName: string): void {
    const count = (this.failures.get(providerName) || 0) + 1
    this.failures.set(providerName, count)
    if (count >= this.threshold) {
      this.openUntil.set(providerName, Date.now() + this.resetMs)
      console.warn(`[CircuitBreaker] ${providerName} circuit OPEN for ${this.resetMs / 60000} minutes`)
    }
  }

  recordSuccess(providerName: string): void {
    this.failures.set(providerName, 0)
    this.openUntil.delete(providerName)
  }

  getStatus(providerName: string): { open: boolean; failures: number; resetAt: number | null } {
    return {
      open: this.isOpen(providerName),
      failures: this.failures.get(providerName) || 0,
      resetAt: this.openUntil.get(providerName) || null,
    }
  }
}
