import pg from 'pg';
import { postgresOptions } from './pg-connect.js';
let pool;
export function db(){
  if(!pool){
    if(!process.env.DATABASE_URL) throw new Error('Database connection unavailable');
    pool=new pg.Pool({...postgresOptions(process.env.DATABASE_URL),max:1,idleTimeoutMillis:10000});
  }
  return pool;
}
export async function q(sql,params=[]){return db().query(sql,params);}
export async function one(sql,params=[]){return (await q(sql,params)).rows[0]||null;}
export async function transaction(callback){const client=await db().connect();try{await client.query('BEGIN');const result=await callback(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
