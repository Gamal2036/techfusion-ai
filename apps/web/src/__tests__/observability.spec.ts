describe('Frontend Observability (AH-2D.2)', () => {
  describe('Observability Module', () => {
    it('reportError does not throw when disabled', () => {
      const { reportError } = require('../lib/observability');
      expect(() => reportError(new Error('test'), 'TestComponent')).not.toThrow();
    });

    it('reportPerformance does not throw when disabled', () => {
      const { reportPerformance } = require('../lib/observability');
      expect(() => reportPerformance([])).not.toThrow();
    });

    it('initFrontendObservability does not throw', () => {
      const { initFrontendObservability } = require('../lib/observability');
      expect(() => initFrontendObservability()).not.toThrow();
    });
  });
});
