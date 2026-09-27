import { Glass, GlassButton, GlassDialog, GlassPanel, toast } from 'meniscus';
import { GlassComparison } from './GlassComparison';
import { plateSrc, useTheme } from '../shared/theme';
import './patterns.css';

function PrintPreview() {
  return <GlassPanel radius={24} className="pattern-panel"><h3>Keep a little light.</h3><p>Save this plate to your collection of optical experiments.</p><GlassButton className="ui-button">Save plate</GlassButton></GlassPanel>;
}

export function PatternGallery() {
  const theme = useTheme();
  const saved = () => toast('Plate saved for this demo.');
  return (
    <section className="pattern-gallery" aria-label="Compare interface patterns" style={{ ['--sheet' as string]: `url(${plateSrc('opticks-plate-4', theme)})` }}>
      <p className="caption">Drag each divider to compare the same pattern in flat and glass. Arrow keys move the focused divider; Home and End reveal either surface.</p>
      <div className="pattern-gallery__grid">
        <GlassComparison label="Navigation"><Glass as="nav" radius="capsule" className="pattern-nav"><b>Opticks</b><span>Plates</span><span>Notes</span><GlassButton className="ui-button">Collect</GlassButton></Glass></GlassComparison>
        <GlassComparison label="Card"><GlassPanel radius={24} className="pattern-panel"><p className="num">Book I · Plate II</p><h3>The nature of light</h3><p>Rays, prisms and the curved surfaces that bend them.</p><GlassButton className="ui-button">View plate</GlassButton></GlassPanel></GlassComparison>
        <GlassComparison label="Modal"><PrintPreview /></GlassComparison>
        <GlassComparison label="Toast"><Glass radius={20} className="pattern-toast"><b>Plate saved</b><p>Your collection has a new experiment.</p></Glass></GlassComparison>
      </div>
      <div className="actions-row">
        <GlassDialog label="Keep a little light." radius={24} className="pattern-panel" trigger={<button type="button" className="action action--primary">Try the modal</button>}>
          <h3>Keep a little light.</h3>
          <p>This is a local demo. Save the plate to see its confirmation.</p>
          <form method="dialog" className="actions-row">
            <GlassButton type="submit" className="ui-button" onClick={saved}>Save plate</GlassButton>
            <button type="submit" className="action action--quiet">Cancel</button>
          </form>
        </GlassDialog>
        <button type="button" className="action action--quiet" onClick={saved}>Show a toast</button>
      </div>
    </section>
  );
}
