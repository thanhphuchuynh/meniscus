import { Glass, GlassButton, GlassPanel } from 'meniscus';
import { useEffect, useRef, useState } from 'react';
import { GlassComparison } from './GlassComparison';
import { plateSrc, useTheme } from '../shared/theme';

function PrintPreview() {
  return <GlassPanel radius={24} className="pattern-panel"><h3>Keep a little light.</h3><p>Save this plate to your collection of optical experiments.</p><GlassButton className="ui-button">Save plate</GlassButton></GlassPanel>;
}

export function PatternGallery() {
  const theme = useTheme();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [toast, setToast] = useState(false);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(false), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
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
        <button ref={trigger} type="button" className="action action--primary" onClick={() => dialog.current?.showModal()}>Try the modal</button>
        <button type="button" className="action action--quiet" onClick={() => setToast(true)}>Show a toast</button>
      </div>
      <dialog ref={dialog} className="pattern-dialog" aria-labelledby="pattern-dialog-title" onClose={() => trigger.current?.focus()}>
        <GlassPanel radius={24} className="pattern-panel">
          <h3 id="pattern-dialog-title">Keep a little light.</h3><p>This is a local demo. Save the plate to see its confirmation.</p>
          <form method="dialog" className="actions-row">
            <GlassButton type="submit" className="ui-button" onClick={() => setToast(true)}>Save plate</GlassButton>
            <button type="submit" className="action action--quiet">Cancel</button>
          </form>
        </GlassPanel>
      </dialog>
      <div className="pattern-feedback" role="status" aria-live="polite">
        {toast ? <Glass radius={20} className="pattern-toast"><b>Plate saved for this demo.</b><button type="button" className="action action--quiet" onClick={() => setToast(false)}>Dismiss</button></Glass> : null}
      </div>
    </section>
  );
}
