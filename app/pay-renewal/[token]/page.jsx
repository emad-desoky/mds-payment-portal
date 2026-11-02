import Brand from '../../../components/Brand.jsx';
import MonthlyCheckout from '../../../components/MonthlyCheckout.jsx';
export const dynamic='force-dynamic';
export const metadata={title:'Monthly payment | MDS Finance',robots:{index:false,follow:false}};
export default async function MonthlyPaymentPage({params}){
 const {token}=await params;
 return <main className="checkout-page"><header className="topbar checkout-head"><Brand/><div className="secure-label">SECURE MONTHLY PAYMENT</div></header>
  <MonthlyCheckout token={token}/>
  <footer className="footer container"><span>Medical Digital Solutions</span><span>Payments processed securely by Kashier</span></footer>
 </main>;
}
