import { Plate } from '../shared/chrome';
import { sitePath } from '../shared/paths';
import { plateSrc, useTheme } from '../shared/theme';
import { MusicPlayer, VideoPlayer } from './MediaPlayers';

export function PlateMedia() {
  const theme = useTheme();
  return (
    <Plate folio="Plate VII" id="demos" className="media-showcase" label="Glass in use">
      <div className="media-showcase__text">
        <h2>Glass in use</h2>
        <p>Play the film or the original étude. The controls are real glass over moving content, with native media and keyboard seeking underneath.</p>
      </div>
      <div className="media-showcase__grid" style={{ ['--sheet' as string]: `url(${plateSrc('opticks-plate-4', theme)})` }}>
        <figure className="media-showcase__figure media-showcase__figure--video">
          <div className="media-showcase__stage"><VideoPlayer /></div>
          <figcaption className="caption"><b>Fig. 7a.</b> Two of Newton’s plates drift under glass controls. Scrub the engraved scale to preview a frame; its glass lens rides the rule.</figcaption>
        </figure>
        <figure className="media-showcase__figure media-showcase__figure--music">
          <div className="media-showcase__stage"><MusicPlayer /></div>
          <figcaption className="caption"><b>Fig. 7b.</b> <i>Prism étude</i>, an original 20-second composition for struck glass, in a glass player.</figcaption>
        </figure>
      </div>
      <a className="action action--quiet media-showcase__more" href={sitePath('/components/#patterns')}>Explore more interface patterns</a>
    </Plate>
  );
}
