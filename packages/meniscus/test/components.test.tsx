// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { GlassButton, GlassCheckbox, GlassGlyph, GlassPanel, GlassProvider, GlassSelect, GlassTabs, GlassTextField } from '../src';

afterEach(cleanup);

it('GlassButton keeps button semantics, disabled behavior, and a forwarded ref', () => {
  const ref = { current: null as HTMLButtonElement | null };
  const onClick = vi.fn();
  const { getByRole, rerender } = render(<GlassButton ref={ref} onClick={onClick}>Save</GlassButton>);
  const button = getByRole('button', { name: 'Save' }) as HTMLButtonElement;
  expect(ref.current).toBe(button);
  expect(button.type).toBe('button');
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
  rerender(<GlassButton ref={ref} disabled onClick={onClick}>Save</GlassButton>);
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
});

it('GlassTabs supports keyboard selection with tab and panel semantics', () => {
  const { getByRole, queryByText } = render(
    <GlassTabs label="Library views" items={[
      { value: 'all', label: 'All', content: 'All items' },
      { value: 'saved', label: 'Saved', content: 'Saved items' },
      { value: 'recent', label: 'Recent', content: 'Recent items' },
    ]} />,
  );
  const first = getByRole('tab', { name: 'All' });
  const second = getByRole('tab', { name: 'Saved' });
  expect(first.getAttribute('aria-selected')).toBe('true');
  expect(queryByText('All items')).not.toBeNull();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(second.getAttribute('aria-selected')).toBe('true');
  expect(second).toBe(document.activeElement);
  expect(getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(second.id);
  expect(queryByText('All items')?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(true);
  expect(queryByText('Saved items')).not.toBeNull();
  expect(document.getElementById(first.getAttribute('aria-controls')!)).not.toBeNull();
});

it('GlassTabs skips disabled tabs and reports controlled changes', () => {
  const onValueChange = vi.fn();
  const items = [
    { value: 'all', label: 'All', content: 'All items' },
    { value: 'draft', label: 'Draft', content: 'Draft items', disabled: true },
    { value: 'saved', label: 'Saved', content: 'Saved items' },
  ];
  const { getByRole, rerender } = render(<GlassTabs label="Views" items={items} value="all" onValueChange={onValueChange} />);
  fireEvent.keyDown(getByRole('tab', { name: 'All' }), { key: 'ArrowRight' });
  expect(onValueChange).toHaveBeenCalledWith('saved');
  rerender(<GlassTabs label="Views" items={items} value="saved" onValueChange={onValueChange} />);
  expect(getByRole('tab', { name: 'Saved' }).getAttribute('aria-selected')).toBe('true');
  expect(getByRole('tab', { name: 'Draft' }).hasAttribute('disabled')).toBe(true);
});

it('GlassPanel preserves the content and accessible label', () => {
  const { getByRole } = render(<GlassPanel role="region" aria-label="Account summary">Balance</GlassPanel>);
  expect(getByRole('region', { name: 'Account summary' }).textContent).toContain('Balance');
});

it('GlassTextField keeps native labeling, value changes, validation and ref', () => {
  const ref = { current: null as HTMLInputElement | null };
  const onChange = vi.fn();
  const { getByRole } = render(<GlassTextField ref={ref} label="Project name" name="project" required onChange={onChange} />);
  const input = getByRole('textbox', { name: 'Project name' }) as HTMLInputElement;
  expect(ref.current).toBe(input);
  expect(input.required).toBe(true);
  fireEvent.change(input, { target: { value: 'Atlas' } });
  expect(input.value).toBe('Atlas');
  expect(onChange).toHaveBeenCalledOnce();
});

it('GlassSelect keeps the native option and disabled behavior', () => {
  const { getByRole } = render(
    <GlassSelect label="Material" name="material" defaultValue="glass" disabled>
      <option value="glass">Glass</option>
      <option value="water">Water</option>
    </GlassSelect>,
  );
  const select = getByRole('combobox', { name: 'Material' }) as HTMLSelectElement;
  expect(select.value).toBe('glass');
  expect(select.disabled).toBe(true);
});

it('GlassCheckbox toggles through its label and submits a native value', () => {
  const { getByRole, getByText } = render(<GlassCheckbox name="alerts" value="yes" label="Send alerts" />);
  const checkbox = getByRole('checkbox', { name: 'Send alerts' }) as HTMLInputElement;
  expect(checkbox.checked).toBe(false);
  fireEvent.click(getByText('Send alerts'));
  expect(checkbox.checked).toBe(true);
  expect(checkbox.value).toBe('yes');
});

it('GlassTabs shows the hidden panel holding the first invalid field of a submit', () => {
  const { getByRole, getByLabelText } = render(
    <form>
      <GlassTabs label="Steps" items={[
        { value: 'one', label: 'One', content: <input aria-label="Name" name="name" /> },
        { value: 'two', label: 'Two', content: <input aria-label="Email" name="email" required /> },
      ]} />
    </form>,
  );
  const email = getByLabelText('Email') as HTMLInputElement;
  const panel = email.closest('[role="tabpanel"]') as HTMLElement;
  expect(panel.hidden).toBe(true);
  act(() => {
    (email.form as HTMLFormElement).checkValidity();
  });
  expect(panel.hidden).toBe(false);
  expect(getByRole('tab', { name: 'Two' }).getAttribute('aria-selected')).toBe('true');
});

it('disabled controls keep their glass still and look disabled', () => {
  const { container, getByRole } = render(
    <>
      <GlassButton disabled>Save</GlassButton>
      <GlassCheckbox label="Alerts" disabled />
      <GlassCheckbox label="News" />
    </>,
  );
  // An interactive glass carries the pointer-light layer; a disabled one doesn't.
  const lights = container.querySelectorAll('[data-meniscus-layer="light"]');
  expect(lights).toHaveLength(1);
  expect(getByRole('checkbox', { name: 'News' }).closest('label')!.contains(lights[0]!)).toBe(true);
  expect((getByRole('button', { name: 'Save' }) as HTMLElement).style.opacity).toBe('0.5');
  expect(getByRole('checkbox', { name: 'Alerts' }).closest('label')!.style.opacity).toBe('0.5');
});

it('text fields and selects draw focus on the whole field, not a ring inside it', () => {
  const { getByRole } = render(
    <>
      <GlassTextField label="Email" />
      <GlassSelect label="Plate"><option>II</option></GlassSelect>
    </>,
  );
  const input = getByRole('textbox', { name: 'Email' });
  const field = input.closest('label') as HTMLElement;
  expect(input.style.outline).toBe('none');
  expect((getByRole('combobox', { name: 'Plate' }) as HTMLElement).style.outline).toBe('none');
  // jsdom can't read a var() outline back through style.outline, so read the attribute.
  expect(field.getAttribute('style')).not.toContain('outline');
  act(() => input.focus());
  expect(field.getAttribute('style')).toContain('outline: var(--meniscus-focus-ring, auto)');
  act(() => input.blur());
  expect(field.getAttribute('style')).not.toContain('outline');
});

it('GlassCheckbox draws its tick in glass and follows controlled and uncontrolled state', () => {
  const tick = (el: HTMLElement) => (el.closest('label')!.querySelector('path') as SVGPathElement).style.strokeDashoffset;
  const { getByRole, getByText, rerender } = render(<GlassCheckbox label="Framed" name="framed" />);
  const box = getByRole('checkbox', { name: 'Framed' }) as HTMLInputElement;
  expect(tick(box)).toBe('1');
  fireEvent.click(getByText('Framed'));
  expect(box.checked).toBe(true);
  expect(tick(box)).toBe('0');
  rerender(<GlassCheckbox label="Framed" name="framed" checked={false} onChange={() => {}} />);
  expect(tick(getByRole('checkbox', { name: 'Framed' }))).toBe('1');
});

it('GlassGlyph turns its content into glass, and steps aside when glass is off', () => {
  // jsdom drops url() filters from inline styles, so this checks the filter the glyph renders.
  const { container, rerender, getByTestId } = render(<GlassGlyph><svg data-testid="icon" /></GlassGlyph>);
  expect(getByTestId('icon')).not.toBeNull();
  expect(container.querySelector('filter feSpecularLighting feDistantLight')).not.toBeNull();
  rerender(<GlassProvider mode="none"><GlassGlyph><svg data-testid="icon" /></GlassGlyph></GlassProvider>);
  expect(getByTestId('icon')).not.toBeNull();
  expect(container.querySelector('filter')).toBeNull();
});
