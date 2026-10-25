import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import App from './App';
import { versionInfo } from './version';

vi.mock('./components/Viewport', () => ({ default: () => null }));

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

function addUnit(name, count) {
  fireEvent.click(screen.getAllByRole('button', { name: /add (your first )?unit/i })[0]);
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(within(dialog).getByLabelText('How many'), { target: { value: String(count) } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
}

test('starts with an empty collection and a way to skip it', () => {
  render(<App />);
  expect(screen.getByText('List what you own. The cases follow.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Switch to Single bin' }));
  expect(screen.getByTestId('bin-summary')).toHaveTextContent(/\d × \d units, \d+u high/);
  expect(screen.getByTestId('fit-ok')).toHaveTextContent('All 10 miniatures fit');
});

test('shows the version in the header', () => {
  render(<App />);
  expect(screen.getByTestId('app-version')).toHaveTextContent(versionInfo().label);
});

test('units wait on the shelf until they are sorted into cases', () => {
  render(<App />);
  addUnit('Intercessors', 6);
  addUnit('Assault squad', 4);
  expect(screen.getByTestId('collection-summary')).toHaveTextContent('10 minis, 10 still need a home');
  fireEvent.click(screen.getByRole('button', { name: 'Sort into cases' }));
  expect(screen.getByTestId('collection-summary')).toHaveTextContent('10 minis in 1 case');
  expect(screen.getByText('Every miniature has a home.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Case 1: / })).toBeInTheDocument();
});

test('a unit can be moved into a case from its shelf menu, and taken out again', () => {
  render(<App />);
  addUnit('Intercessors', 3);
  fireEvent.click(screen.getByRole('button', { name: /Intercessors, 3 waiting/ }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'New case' }));
  const detail = screen.getByRole('complementary', { name: 'Selected case' });
  expect(within(detail).getByText('3 of 3')).toBeInTheDocument();
  fireEvent.click(within(detail).getByRole('button', { name: 'One less Intercessors' }));
  expect(within(detail).getByText(/2 of 3 · 1 more on the shelf/)).toBeInTheDocument();
  expect(screen.getByTestId('collection-summary')).toHaveTextContent('3 minis, 1 still needs a home');
});

test('deleting a case puts its minis back and can be undone', () => {
  render(<App />);
  addUnit('Intercessors', 3);
  fireEvent.click(screen.getByRole('button', { name: 'Sort into cases' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete Case 1' }));
  expect(screen.getByTestId('collection-summary')).toHaveTextContent('3 minis, 3 still need a home');
  fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Undo' }));
  expect(screen.getByTestId('collection-summary')).toHaveTextContent('3 minis in 1 case');
});

test('the collection survives a reload', async () => {
  const { unmount } = render(<App />);
  addUnit('Intercessors', 3);
  await new Promise((r) => setTimeout(r, 350));
  unmount();
  render(<App />);
  expect(screen.getByRole('button', { name: 'Edit Intercessors' })).toBeInTheDocument();
});

test('a fixed single bin that is too small shows a fix that resolves it', () => {
  window.localStorage.setItem('ministoregen.mode', 'single');
  render(<App />);
  fireEvent.click(screen.getByLabelText('Size footprint automatically'));
  fireEvent.change(screen.getByLabelText('Width'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Length'), { target: { value: '1' } });
  const fix = screen.getByRole('button', { name: 'Size the bin automatically' });
  expect(within(fix.parentElement).getByText(/only \d+ of 10 fit/)).toBeInTheDocument();
  fireEvent.click(fix);
  expect(screen.getByTestId('fit-ok')).toBeInTheDocument();
});

test('saves a single bin to the library', () => {
  window.localStorage.setItem('ministoregen.mode', 'single');
  render(<App />);
  fireEvent.click(screen.getByLabelText('Save'));
  fireEvent.click(screen.getByRole('button', { name: 'Library' }));
  expect(within(screen.getByRole('dialog')).getByText('My miniatures')).toBeInTheDocument();
});
