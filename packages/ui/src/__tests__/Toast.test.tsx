import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { Toaster } from '../components/Toast';

describe('Toaster', () => {
  it('renders without crashing', () => {
    const { container } = render(<Toaster />);
    expect(container).toBeTruthy();
  });
});
