import { Glass, GlassButton } from 'meniscus';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { GlassIcon } from '../shared/GlassIcon';
import { Icon } from '../shared/Icon';
import { sitePath } from '../shared/paths';
import { useTheme } from '../shared/theme';
import './media-players.css';

const ICON_STYLE = { padding: 0 };

function clock(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function useMedia<T extends HTMLMediaElement>() {
  const ref = useRef<T>(null);
  const [at, setAt] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    const media = ref.current;
    if (!media) return;
    if (!media.paused) {
      media.pause();
      return;
    }
    try {
      await media.play();
      setError('');
    } catch {
      setError('Playback was blocked. Press play again to retry.');
    }
  }

  function seek(seconds: number) {
    const media = ref.current;
    if (!media || !Number.isFinite(media.duration)) return;
    media.currentTime = Math.max(0, Math.min(media.duration, seconds));
    setAt(media.currentTime);
  }

  return {
    ref, at, duration, playing, error, toggle, seek,
    events: {
      onLoadedMetadata: () => setDuration(ref.current?.duration ?? 0),
      onTimeUpdate: () => setAt(ref.current?.currentTime ?? 0),
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
      onError: () => setError('This media could not load. Reload the page to try again.'),
      onEmptied: () => {
        setPlaying(false);
        setAt(0);
      },
    },
  };
}

function MediaSeek({ label, at, duration, playing, mediaRef, onSeek, videoPreview = false }: {
  label: string;
  at: number;
  duration: number;
  playing: boolean;
  mediaRef: RefObject<HTMLMediaElement | null>;
  onSeek: (seconds: number) => void;
  videoPreview?: boolean;
}) {
  const visual = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [focused, setFocused] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const showingPreview = scrubbing || focused;

  useEffect(() => {
    if (!showingPreview || !videoPreview) return;
    const video = mediaRef.current as HTMLVideoElement | null;
    const context = canvas.current?.getContext('2d');
    if (!video || !context) return;
    const draw = () => {
      if (video.readyState >= 2) context.drawImage(video, 0, 0, 160, 90);
    };
    draw();
    video.addEventListener('seeked', draw);
    video.addEventListener('timeupdate', draw);
    return () => {
      video.removeEventListener('seeked', draw);
      video.removeEventListener('timeupdate', draw);
    };
  }, [showingPreview, videoPreview, mediaRef]);

  function paint(seconds: number) {
    const progress = duration > 0 ? Math.max(0, Math.min(100, seconds / duration * 100)) : 0;
    visual.current?.style.setProperty('--seek', `${progress}%`);
    preview.current?.style.setProperty('--seek', `${progress}%`);
  }

  // Seek feedback has no easing delay. Playback follows the media clock each
  // frame without re-rendering React or resizing/rebuilding a glass filter.
  useLayoutEffect(() => { paint(at); }, [at, duration]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      paint(mediaRef.current?.currentTime ?? 0);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration, mediaRef]);

  return (
    <div className="media-seek" data-scrubbing={scrubbing || undefined}>
      {/* The engraved scale the playground uses, with a glass lens for its thumb: it bends the rule it rides. */}
      <div ref={visual} className="media-seek__visual" aria-hidden="true">
        <span className="media-seek__scale">
          <Glass className="media-seek__lens" radius="capsule" tint="var(--glass-wash)" />
        </span>
      </div>
      <div ref={preview} className="media-seek__preview-anchor" aria-hidden="true">
        {showingPreview ? (
          <Glass className={`media-seek__preview${videoPreview ? ' media-seek__preview--video' : ''}`} radius={16} tint="var(--glass-bar)">
            {videoPreview ? <canvas ref={canvas} width={160} height={90} /> : null}
            <span className="num">{clock(at)}</span>
          </Glass>
        ) : null}
      </div>
      <input
        type="range"
        min={0}
        max={duration || 1}
        step="any"
        value={Math.min(at, duration || 1)}
        aria-label={label}
        aria-valuetext={`${clock(at)} of ${clock(duration)}`}
        onChange={(event) => {
          const seconds = Number(event.target.value);
          paint(seconds);
          onSeek(seconds);
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setFocused(false);
          setScrubbing(true);
        }}
        onPointerUp={() => setScrubbing(false)}
        onPointerCancel={() => setScrubbing(false)}
        onLostPointerCapture={() => setScrubbing(false)}
        onFocus={(event) => setFocused(event.currentTarget.matches(':focus-visible'))}
        onBlur={() => { setScrubbing(false); setFocused(false); }}
      />
    </div>
  );
}

export const VIDEO_CODE = `import { Glass, GlassButton } from 'meniscus';

// A native video element provides playback and seeking.
// The glass controls refract the moving frame in supported browsers.
<div className="video-frame">
  <video ref={videoRef} src={videoUrl} playsInline preload="metadata" />
  <Glass radius="capsule" className="video-controls">
    <GlassButton onClick={toggle}>{playing ? 'Pause' : 'Play'}</GlassButton>
    <input type="range" aria-label="Video position" onChange={seek} />
  </Glass>
</div>`;

export const MUSIC_CODE = `import { Glass, GlassButton } from 'meniscus';

// Keep the media element native; use glass for its visible controls.
<Glass radius={28} className="music-player">
  <audio ref={audioRef} src={trackUrl} loop preload="metadata" />
  <h3>Prism étude</h3>
  <input type="range" aria-label="Music position" onChange={seek} />
  <GlassButton onClick={toggle}>{playing ? 'Pause' : 'Play'}</GlassButton>
</Glass>`;

export function VideoPlayer() {
  const media = useMedia<HTMLVideoElement>();
  const theme = useTheme();
  const film = sitePath(`/media/opticks-film${theme === 'lantern' ? '-lantern' : ''}`);
  const frame = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame.current?.requestFullscreen();
      setFullscreenError('');
    } catch {
      setFullscreenError('Fullscreen is unavailable in this browser.');
    }
  }

  return (
    <div ref={frame} className="media-video" role="group" aria-label="Opticks film player">
      <video
        ref={media.ref}
        className="media-video__picture"
        src={`${film}.mp4`}
        poster={`${film}.webp`}
        muted={muted}
        playsInline
        preload="metadata"
        {...media.events}
      />
      {!media.playing ? (
        <GlassButton className="media-video__hero-play" style={ICON_STYLE} aria-hidden="true" tabIndex={-1} onClick={media.toggle}>
          <GlassIcon name="play" />
        </GlassButton>
      ) : null}
      <Glass className="media-video__controls" radius="capsule" tint="var(--glass-bar)" role="group" aria-label="Video controls">
        <button type="button" className="media-player__plain-control" aria-label={media.playing ? 'Pause video' : 'Play video'} onClick={media.toggle}>
          <Icon name={media.playing ? 'pause' : 'play'} />
        </button>
        <span className="media-video__time num">{clock(media.at)}</span>
        <MediaSeek videoPreview label="Video position" at={media.at} duration={media.duration} playing={media.playing} mediaRef={media.ref} onSeek={media.seek} />
        <span className="media-video__time num">{clock(media.duration)}</span>
        <button type="button" className="media-player__plain-control" aria-label={muted ? 'Unmute video' : 'Mute video'} onClick={() => setMuted((value) => !value)}>
          <Icon name={muted ? 'muted' : 'volume'} />
        </button>
        <button type="button" className="media-player__plain-control" aria-label="Fullscreen video" onClick={fullscreen}>
          <Icon name="expand" />
        </button>
      </Glass>
      {media.error || fullscreenError ? <p className="media-video__error" role="status">{media.error || fullscreenError}</p> : null}
    </div>
  );
}

export function MusicPlayer() {
  const media = useMedia<HTMLAudioElement>();
  return (
    <Glass radius={28} className="media-music" role="group" aria-label="Prism étude music player" data-playing={media.playing || undefined}>
      <audio ref={media.ref} src={sitePath('/media/prism-etude.m4a')} loop preload="metadata" {...media.events} />
      <div className="media-music__record" aria-hidden="true">
        <div className="media-music__engraving" />
        <Glass className="media-music__spindle" radius="capsule" tint="var(--glass-wash)" />
      </div>
      <div className="media-music__body">
        <p className="media-music__edition">Original composition · 20 seconds</p>
        <h3>Prism étude</h3>
        <p className="media-music__subtitle">A small piece for struck glass and light</p>
        <MediaSeek label="Music position" at={media.at} duration={media.duration} playing={media.playing} mediaRef={media.ref} onSeek={media.seek} />
        <p className="media-music__times num"><span>{clock(media.at)}</span><span>{clock(media.duration)}</span></p>
        <div className="media-music__controls">
          <GlassButton className="ui-icon-button" style={ICON_STYLE} aria-label="Back 5 seconds" onClick={() => media.seek(media.at - 5)}>
            <GlassIcon name="back5" />
          </GlassButton>
          <GlassButton className="ui-icon-button ui-icon-button--main" style={ICON_STYLE} aria-label={media.playing ? 'Pause music' : 'Play music'} onClick={media.toggle}>
            <GlassIcon name={media.playing ? 'pause' : 'play'} />
          </GlassButton>
          <GlassButton className="ui-icon-button" style={ICON_STYLE} aria-label="Forward 5 seconds" onClick={() => media.seek(media.at + 5)}>
            <GlassIcon name="forward5" />
          </GlassButton>
        </div>
        {media.error ? <p className="media-music__error" role="status">{media.error}</p> : null}
      </div>
    </Glass>
  );
}
