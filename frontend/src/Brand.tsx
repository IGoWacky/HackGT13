import logo from './assets/rxrescue-logo.png'

/** Reuse the approved logo artwork in a compact, accessible header lockup. */
export default function Brand() {
  return <span className="brand-lockup"><img src={logo} alt="RxRescue" /></span>
}
