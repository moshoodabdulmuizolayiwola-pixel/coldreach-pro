import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export const handler: Handler = async (event, context) => {
  const path = event.path.replace('/api/', '');
  const method = event.httpMethod;

  // GET /api/accounts
  if (path === 'accounts' && method === 'GET') {
    const { data, error } = await supabase.from('accounts').select('*');
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify(data) };
  }

  // POST /api/accounts/:id/warmup
  if (path.match(/^accounts\/[^/]+\/warmup$/) && method === 'POST') {
    const id = path.split('/')[1];
    const { is_warming_up } = JSON.parse(event.body || '{}');
    const { error } = await supabase.from('accounts').update({ is_warming_up }).eq('id', id);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  // POST /api/accounts/:id/settings
  if (path.match(/^accounts\/[^/]+\/settings$/) && method === 'POST') {
    const id = path.split('/')[1];
    const { target_send, send_interval_seconds } = JSON.parse(event.body || '{}');
    const { error } = await supabase.from('accounts').update({ target_send, send_interval_seconds }).eq('id', id);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  // DELETE /api/accounts/:id
  if (path.match(/^accounts\/[^/]+$/) && method === 'DELETE') {
    const id = path.split('/')[1];
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  return { statusCode: 404, body: 'Not Found' };
};
