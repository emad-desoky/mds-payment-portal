import pg from 'pg';
let pool;
export function db(){
  if(!pool){
    if(!process.env.DATABASE_URL) throw new Error('Database connection unavailable');
    pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:4,idleTimeoutMillis:10000,connectionTimeoutMillis:12000,ssl:{rejectUnauthorized:true}});
  }
  return pool;
}
export async function q(sql,params=[]){return db().query(sql,params);}
export async function one(sql,params=[]){return (await q(sql,params)).rows[0]||null;}
export async function transaction(callback){const client=await db().connect();try{await client.query('BEGIN');const result=await callback(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
