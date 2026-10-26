import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import App from './App';
import { addUnit as withUnit, makeDefaultCollection, makeUnit } from './model/collection';
import { makeDefaultProject } from './model/project';
import { collectionLink } from './state/shareLink';
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

test('a unit can mix models on different bases, and they stay together in one case', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add your first unit/i }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Twin Lance' } });
  fireEvent.change(within(dialog).getByLabelText('How many'), { target: { value: '2' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add a different model' }));
  const models = within(dialog).getAllByLabelText('Model');
  fireEvent.change(models[0], { target: { value: 'Battlesuit' } });
  fireEvent.change(models[1], { target: { value: 'Drone' } });
  fireEvent.change(within(dialog).getAllByLabelText('How many')[1], { target: { value: '4' } });
  fireEvent.change(within(dialog).getAllByLabelText('Overhang')[0], { target: { value: '10' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
  expect(screen.getByTestId('collection-summary')).toHaveTextContent('6 minis, 6 still need a home');
  fireEvent.click(screen.getByRole('button', { name: 'Sort into cases' }));
  expect(screen.getByTestId('collection-summary')).toHaveTextContent('6 minis in 1 case');
  const detail = screen.getByRole('complementary', { name: 'Selected case' });
  expect(within(detail).getByText('Twin Lance · Battlesuit')).toBeInTheDocument();
  expect(within(detail).getByText('Twin Lance · Drone')).toBeInTheDocument();
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

test('another layout that fits can be picked, and the smallest one again', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Switch to Single bin' }));
  const auto = screen.getByTestId('bin-summary').textContent;
  const choices = within(screen.getByRole('radiogroup', { name: 'Layouts that fit' })).getAllByRole('radio');
  expect(choices.length).toBeGreaterThan(1);
  expect(choices[0]).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(choices[1]);
  const [, size] = /^(\d+ × \d+) bin/.exec(choices[1].getAttribute('aria-label'));
  expect(screen.getByTestId('bin-summary')).toHaveTextContent(`${size} units`);
  expect(screen.getByTestId('fit-ok')).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Layouts that fit' })).getAllByRole('radio')[0]);
  expect(screen.getByTestId('bin-summary')).toHaveTextContent(auto);
});

test('a unit can be picked from the built-in library and adjusted before adding', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pick from a library' }));
  const library = screen.getByRole('dialog');
  expect(within(library).queryByTestId('pack-disclaimer')).not.toBeInTheDocument();
  fireEvent.change(within(library).getByLabelText('Search'), { target: { value: 'drones' } });
  fireEvent.click(within(library).getByRole('button', { name: /Vehicle on 60 mm with 2 drones/ }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getAllByLabelText('Model').map((f) => f.value)).toEqual(['Vehicle', 'Drone']);
  fireEvent.change(within(dialog).getAllByLabelText('How many')[1], { target: { value: '3' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
  expect(screen.getByTestId('collection-summary')).toHaveTextContent('4 minis, 4 still need a home');
});

test('a community library loads from a file, shows the disclaimer and is kept', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pick from a library' }));
  const pack = JSON.stringify({
    format: 'ministoregen-unit-pack',
    version: 1,
    name: 'Community test pack',
    licence: 'CC0',
    units: [{ name: 'Test squad', category: 'Troops', models: [{ shape: 'round', sizeX: 28.5, count: 5 }] }],
  });
  const file = new File([pack], 'pack.json', { type: 'application/json' });
  fireEvent.change(screen.getByTestId('pack-file'), { target: { files: [file] } });
  expect(await screen.findByText(/Loaded Community test pack: 1 unit\./)).toBeInTheDocument();
  expect(screen.getByTestId('pack-disclaimer')).toHaveTextContent('not affiliated with or endorsed by Games Workshop');
  expect(screen.getByText('licence: CC0')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Test squad/ }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add' }));
  expect(screen.getByTestId('collection-summary')).toHaveTextContent('5 minis');
  fireEvent.click(screen.getByRole('button', { name: 'From library' }));
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: /Test squad/ })).toBeInTheDocument();
});

test('a shared collection opens only after asking, and can be added to your own', async () => {
  const sharedValue = withUnit(makeUnit(0, { name: 'Friend squad', count: 3 }))({ ...makeDefaultCollection(), name: 'Friend army' });
  render(<App shared={{ kind: 'collection', value: sharedValue }} />);
  let dialog = screen.getByRole('dialog', { name: 'Open a shared collection' });
  expect(dialog).toHaveTextContent('Friend army: 1 unit, 3 minis in 0 cases.');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('List what you own. The cases follow.')).toBeInTheDocument();
  cleanup();

  render(<App shared={{ kind: 'collection', value: sharedValue }} />);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Open' }));
  expect(screen.getByTestId('collection-summary')).toHaveTextContent('3 minis, 3 still need a home');
  await new Promise((resolve) => { setTimeout(resolve, 400); }); // let it reach storage
  cleanup();

  render(<App shared={{ kind: 'collection', value: sharedValue }} />);
  dialog = screen.getByRole('dialog');
  expect(dialog).toHaveTextContent('You already have a collection');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add to mine' }));
  expect(screen.getByTestId('collection-summary')).toHaveTextContent('6 minis, 6 still need a home');
});

test('a shared single bin opens in single-bin mode', () => {
  render(<App shared={{ kind: 'bin', value: { ...makeDefaultProject(), name: 'Shared tray' } }} />);
  expect(screen.getByDisplayValue('Shared tray')).toBeInTheDocument();
});

test('a broken link says so', () => {
  render(<App shared={{ error: 'This link is damaged or incomplete. Ask for a new one.' }} />);
  expect(screen.getByText(/This link is damaged/)).toBeInTheDocument();
});

test('a link pasted into an open tab is picked up', async () => {
  render(<App />);
  const link = await collectionLink(withUnit(makeUnit(0, { name: 'Pasted', count: 2 }))({ ...makeDefaultCollection(), name: 'Pasted army' }));
  window.history.replaceState(null, '', new URL(link).hash);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  expect(await screen.findByRole('dialog', { name: 'Open a shared collection' })).toHaveTextContent('Pasted army');
  expect(window.location.hash).toBe('');
});
