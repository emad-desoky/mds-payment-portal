import {redirect} from 'next/navigation';import {getUser} from '../../lib/security.js';import ClientCenter from '../../components/ClientCenter.jsx';
export const dynamic='force-dynamic';export default async function Page(){const user=await getUser();if(!user)redirect('/login');if(user.role==='finance_admin')redirect('/billing/admin');return <ClientCenter/>}
