const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const env = fs.readFileSync('.env', 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1]
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]

const supabase = createClient(url, key)

async function run() {
  const { data, error } = await supabase.from('projects').select('*')
  console.log('Projects:', data)
  if (error) console.error(error)
}
run()
