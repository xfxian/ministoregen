import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import App from './App';

vi.mock('./components/Viewport', () => ({ default: () => null }));

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

test('starts with one group and a bin that fits it', () => {
  render(<App />);
  expect(screen.getByText('Miniature Storage Generator')).toBeInTheDocument();
  expect(screen.getByTestId('bin-summary')).toHaveTextContent(/\d × \d units, \d+u high/);
  expect(screen.getByTestId('fit-ok')).toHaveTextContent('All 10 miniatures fit');
});

test('adding a group grows the collection and the fit check follows', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add group/i }));
  expect(screen.getByTestId('fit-ok')).toHaveTextContent('All 20 miniatures fit');
});

test('a fixed bin that is too small shows a fix that resolves it', () => {
  render(<App />);
  fireEvent.click(screen.getByLabelText('Size footprint automatically'));
  const width = screen.getByLabelText('Width');
  const length = screen.getByLabelText('Length');
  fireEvent.change(width, { target: { value: '1' } });
  fireEvent.change(length, { target: { value: '1' } });
  const fix = screen.getByRole('button', { name: 'Size the bin automatically' });
  expect(within(fix.parentElement).getByText(/only \d+ of 10 fit/)).toBeInTheDocument();
  fireEvent.click(fix);
  expect(screen.getByTestId('fit-ok')).toBeInTheDocument();
});

test('saves the design to the library', () => {
  render(<App />);
  fireEvent.click(screen.getByLabelText('Save'));
  fireEvent.click(screen.getByLabelText('Library'));
  expect(screen.getByText('My miniatures')).toBeInTheDocument();
});
