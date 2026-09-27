import { GlassDialog, GlassMenu, GlassNavbar, GlassPopover, GlassProvider, GlassSegmented, GlassSidebar, GlassSlider, GlassSwitch, GlassToaster, GlassTooltip } from '../../src';

/** Every component of the kit in one tree, for the server-rendering and hydration tests. */
export function Kit() {
  return (
    <GlassProvider>
      <GlassNavbar label="Main">
        <a href="#plates">Plates</a>
      </GlassNavbar>
      <GlassSidebar label="Library">
        <a href="#figures">Figures</a>
      </GlassSidebar>
      <GlassDialog label="Order a print" trigger={<button type="button">Order</button>}>Body</GlassDialog>
      <GlassPopover label="Share" trigger={<button type="button">Share</button>}>Links</GlassPopover>
      <GlassTooltip content="Save to collection">
        <button type="button">Save</button>
      </GlassTooltip>
      <GlassMenu label="Plate" trigger={<button type="button">Plate</button>} items={[{ label: 'Open', onSelect: () => {} }]} />
      <GlassToaster />
      <GlassSwitch label="Sound" />
      <GlassSlider label="Index" min={1} max={2} step={0.01} defaultValue={1.5} />
      <GlassSegmented label="Medium" options={[{ value: 'water', label: 'Water' }, { value: 'glass', label: 'Glass' }]} />
    </GlassProvider>
  );
}
