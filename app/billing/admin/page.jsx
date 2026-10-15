import {redirect} from 'next/navigation';import {getUser} from '../../../lib/security.js';import AdminCenter from '../../../components/AdminCenter.jsx';
export const dynamic='force-dynamic';export default async function Page(){const user=await getUser();if(!user||user.role!=='finance_admin')redirect('/login');return <AdminCenter changeRequired={user.password_reset_required}/>}
