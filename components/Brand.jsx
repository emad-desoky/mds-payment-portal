import Link from 'next/link';
export default function Brand({light=false}){return <Link className={`brand ${light?'brand-light':''}`} href="/payments" aria-label="Medical Digital Solutions billing"><span className="brand-mark"><span/></span><span className="brand-name">MDS <small>MEDICAL DIGITAL SOLUTIONS</small></span></Link>}
