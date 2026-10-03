/** Brand artwork restored from the supplied references, shared by all layouts. */
export function BrandMark() {
  return <span className="brand-mark"><img src="/assets/brand/mediahub-logo-transparent.png" alt="" width="36" height="36" /></span>;
}
export function BrandLogo() {
  return <><img className="brand-wordmark" src="/assets/brand/mediahub-wordmark.png" alt="MediaHub" width="180" height="60"/><span className="brand-collapsed-icon" role="img" aria-label="MediaHub"><BrandMark /></span></>;
}
