require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function run() {
  const { data, error } = await supabase.from('projects').select('*')
  console.log('Projects:', data)
  if (error) console.error(error)
}
run()
