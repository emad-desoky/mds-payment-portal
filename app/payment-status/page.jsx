import Brand from '../../components/Brand.jsx';import PaymentStatus from '../../components/PaymentStatus.jsx';
export default async function Page({searchParams}){const q=await searchParams;return <main className="checkout-page"><header className="topbar checkout-head"><Brand/></header><PaymentStatus reference={String(q?.reference||'')}/></main>}
