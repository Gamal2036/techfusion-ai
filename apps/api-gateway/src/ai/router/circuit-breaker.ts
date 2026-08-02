export class CircuitBreaker {
  private failures: Map<string, number> = new Map()
  private openUntil: Map<string, number> = new Map()
  private halfOpenProbe: Map<string, boolean> = new Map()
  private readonly threshold: number
  private readonly resetMs: number

  constructor(threshold = 3, resetMs = 600000) {
    this.threshold = threshold
    this.resetMs = resetMs
  }

  isOpen(providerName: string): boolean {
    const until = this.openUntil.get(providerName)
    if (until && Date.now() < until) {
      if (!this.halfOpenProbe.get(providerName)) {
        this.halfOpenProbe.set(providerName, true)
        this.openUntil.delete(providerName)
        this.failures.set(providerName, 0)
        console.log(`[CircuitBreaker] ${providerName} entering half-open state - allowing probe request`)
        return false
      }
      return true
    }
    if (until && Date.now() >= until) {
      this.openUntil.delete(providerName)
      this.failures.set(providerName, 0)
      this.halfOpenProbe.delete(providerName)
    }
    return false
  }

  recordFailure(providerName: string): void {
    const count = (this.failures.get(providerName) || 0) + 1
    this.failures.set(providerName, count)
    this.halfOpenProbe.delete(providerName)
    if (count >= this.threshold) {
      this.openUntil.set(providerName, Date.now() + this.resetMs)
      console.warn(`[CircuitBreaker] ${providerName} circuit OPEN for ${this.resetMs / 60000} minutes`)
    }
  }

  recordSuccess(providerName: string): void {
    this.failures.set(providerName, 0)
    this.openUntil.delete(providerName)
    this.halfOpenProbe.delete(providerName)
  }

  getStatus(providerName: string): { open: boolean; failures: number; resetAt: number | null } {
    return {
      open: this.isOpen(providerName),
      failures: this.failures.get(providerName) || 0,
      resetAt: this.openUntil.get(providerName) || null,
    }
  }
}
