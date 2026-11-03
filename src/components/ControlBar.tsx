import { CollapseIcon, CubeIcon, ExpandIcon, HomeIcon, MinusIcon, NavigationIcon, PlusIcon } from "./icons";

const group = "glass flex items-center overflow-hidden rounded-xl";
const button =
  "grid size-9 place-items-center text-muted transition-colors hover:bg-fg/10 hover:text-fg disabled:opacity-40 aria-pressed:text-accent";

// The map's controls in its bottom-right corner. Every button has a tooltip, since
// icons alone are easy to misread.
export default function ControlBar({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onFit,
  onLocate,
  locating,
  located,
  tilted,
  onTilt,
  fullscreen,
  onFullscreen,
}: {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onLocate: () => void;
  locating: boolean;
  located: boolean;
  tilted: boolean;
  onTilt: () => void;
  fullscreen: boolean;
  onFullscreen: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={group}>
        <button
          type="button"
          className={button}
          onClick={onLocate}
          disabled={locating}
          aria-pressed={located}
          aria-label="Show where I am"
          title="Show where I am"
        >
          <NavigationIcon size={16} className={locating ? "animate-pulse" : ""} />
        </button>
      </div>
      <div className={`${group} max-lg:hidden`}>
        <button type="button" className={button} onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">
          <PlusIcon size={16} />
        </button>
        <span className="w-12 text-center text-[12.5px] font-medium tabular-nums" aria-live="polite">
          {Math.round(zoomPercent)}%
        </span>
        <button type="button" className={button} onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">
          <MinusIcon size={16} />
        </button>
      </div>
      <div className={group}>
        <button type="button" className={button} onClick={onTilt} aria-pressed={tilted} aria-label="3D view" title="3D view">
          <CubeIcon size={16} />
        </button>
        <button type="button" className={button} onClick={onFit} aria-label="Back to all of campus" title="Back to all of campus">
          <HomeIcon size={16} />
        </button>
        <button
          type="button"
          className={button}
          onClick={onFullscreen}
          aria-pressed={fullscreen}
          aria-label={fullscreen ? "Exit full screen" : "Full screen map"}
          title={fullscreen ? "Exit full screen" : "Full screen map"}
        >
          {fullscreen ? <CollapseIcon size={16} /> : <ExpandIcon size={16} />}
        </button>
      </div>
    </div>
  );
}
