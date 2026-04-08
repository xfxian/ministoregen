import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';

vi.mock('./ModelPreview', () => ({ default: () => null }));
vi.mock('three-stdlib', () => ({ STLExporter: vi.fn(() => ({ parse: vi.fn() })) }));

test('renders app bar title', () => {
  render(<App />);
  expect(screen.getByText(/Miniature Storage Generator/i)).toBeInTheDocument();
});
